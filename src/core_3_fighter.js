// =====================================================================================
//  PUPPET BRAWL core - part 3: the fighter (state machine, physics, animation, hit shapes)
// =====================================================================================

const GRAVITY = 2000;          // FU/s^2
const LAUNCH_GRAVITY = 1850;
const NEUTRAL = new Set(["idle", "walk", "crouch", "block", "cblock"]);
const TURNABLE = new Set(["idle", "walk", "crouch", "block", "cblock", "land", "intro", "lobby"]);
const MAX_JUGGLE = 3;
const BUFFER = 5;              // frames a button press stays buffered
const TIP_FRACTION = 0.75;     // toe hitbox sits 75% of the way from ankle to toe

class Fighter {
  constructor(game, seat) {
    this.game = game;
    this.seat = seat;
    this.charIdx = 0;
    this.ch = CHARACTERS[0];
    this.team = seat;
    this.color = PLAYER_COLORS[seat];
    this.active = false;     // fighting this round
    this.onStage = false;    // drawn at all
    this.background = false; // standing at the back of the stage (duel queue)
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; this.facing = 1;
    this.maxHp = 100; this.hp = 100;
    this.state = "lobby"; this.sf = 0;
    this.move = null; this.mf = 0; this.moveSerial = 0;
    this.hitstop = 0; this.stun = 0; this.invuln = 0; this.strikeInvuln = false; this.armored = false;
    this.armorHits = 0; this.throwInvuln = 0;
    this.airAttackUsed = false; this.hitWindow = -1; this.hitIds = new Set();
    this.moveHit = false; this.moveBlocked = false; this.contactFrame = -1;
    this.combo = 0; this.comboDmg = 0; this.juggle = 0; this.hitLevel = "high"; this.crouchHit = false;
    this.blockLow = false; this.ko = false; this.kdOnLand = false;
    this.held = 0; this.prevHeld = 0; this.pendingPress = 0;
    this.taps = []; this.buf = {};
    // animation clock: the clip playing, its restart key and the frame it is on
    this.anim = { name: "", key: "", clip: null, t: 0, rate: 1 };
    this.vis = 1;           // visual scale (vanishing moves)
    this.lift = 0;          // how far the body is lifted to keep it out of the floor
    this.sk = makeSkeleton();
    this.idleT = seat * 17;
    this.parts = [];
    for (let i = 0; i < PART_COUNT; i++) this.parts.push({ model: "limb", x: 0, y: 0, ang: 0, len: 1, r: 1, depth: 0, color: { r: 255, g: 255, b: 255 }, hidden: true });
    this.hurt = [];
    this.tips = {};
    this.thrower = null; this.victim = null; this.throwPelvis = null;
    this.projectile = null;
    this.depthBase = 0;
    this.shakeX = 0;
    this.landLag = 0;
    this.lastAttacker = -1;
    this.lobbyReady = false;
    this.cheering = 0;
    this.wins = 0;
    this.jumpDir = 0;
    this.techWindow = 0;
    this.hitSerial = 0;     // counts hits and blocks taken (restarts reaction clips)
    this.guardF = -999;     // frame block (or away) was last pressed
    this.perfects = 0;      // perfect blocks this match
    /** @type {boolean | undefined} */
    this.perfectOk = undefined;   // CPUs: whether this block may count as perfect
    this.stintDmg = 0;      // tag team: damage taken since tagging in
    this.koFrame = 0;
    this.guardLock = 0;     // frames the guard holds still after blocking, before walking back
    this.benchHeal = 0;     // tag team: health still to win back on the bench
    this.top = 0;
    this.kickV = 0;         // knockback that survives a move's own velocity (bounced off a guard)
    this.lastStop = 0;      // hitstop of this fighter's last contact (for the combo buffer)
    this.setCharacter(0);
  }

  setCharacter(idx) {
    this.charIdx = ((idx % CHARACTERS.length) + CHARACTERS.length) % CHARACTERS.length;
    this.ch = CHARACTERS[this.charIdx];
    this.anim.name = "";
  }

  // ---------------------------------------------------------------- input helpers
  setInput(held, pressed) {
    this.held = held | 0;
    this.pendingPress |= (pressed | 0);
  }
  towardBit() { return this.facing > 0 ? IN.RIGHT : IN.LEFT; }
  awayBit() { return this.facing > 0 ? IN.LEFT : IN.RIGHT; }
  fwd() { const h = this.held; return (h & this.towardBit()) && !(h & this.awayBit()); }
  back() { const h = this.held; return (h & this.awayBit()) && !(h & this.towardBit()); }
  hasPress(bit, win = BUFFER) {
    const f = this.buf[bit];
    return f !== undefined && this.game.frame - f <= win;
  }
  consume(bit) { delete this.buf[bit]; }
  clearInput() { this.buf = {}; this.taps.length = 0; this.pendingPress = 0; }

  readInput() {
    const g = this.game;
    const pressed = this.pendingPress | (this.held & ~this.prevHeld);
    this.pendingPress = 0;
    for (let b = 1; b <= IN.USE; b <<= 1) if (pressed & b) this.buf[b] = g.frame;
    const tb = this.towardBit(), ab = this.awayBit();
    const push = (d) => { this.taps.push({ d, f: g.frame }); if (this.taps.length > 8) this.taps.shift(); };
    // Same-frame presses are recorded vertical first, because every motion that mixes
    // the two starts with down (D,F  D,B  D,U), and players often roll S+D together.
    if (pressed & IN.DOWN) push("D");
    if (pressed & IN.UP) push("U");
    if (pressed & ab) push("B");
    if (pressed & (IN.BLOCK | ab)) this.guardF = g.frame;   // for perfect blocks
    if (pressed & tb) push("F");
    this.prevHeld = this.held;
    return pressed;
  }

  // A motion matches when it is exactly the most recent taps, all within 24 frames and the
  // last one within 14. (A loose subsequence match let F..D,F read as F,F.)
  matchMotion(seq) {
    const now = this.game.frame, n = this.taps.length, L = seq.length;
    if (n < L) return false;
    for (let i = 0; i < L; i++) {
      const t = this.taps[n - L + i];
      if (t.d !== seq[i] || now - t.f > 24) return false;
    }
    return now - this.taps[n - 1].f <= 14;
  }

  checkSpecial() {
    const ch = this.ch;
    if (this.hasPress(IN.SPECIAL)) {
      this.consume(IN.SPECIAL);
      const h = this.held;
      const idx = (h & (IN.DOWN | IN.UP)) ? 2 : this.fwd() ? 1 : 0;
      return ch.specials[idx];
    }
    for (const btn of [IN.PUNCH, IN.KICK]) {
      if (!this.hasPress(btn)) continue;
      for (const id of ch.specials) {
        const m = MOVES[id];
        if ((m.btn === "P") !== (btn === IN.PUNCH)) continue;
        if (this.matchMotion(m.motion)) { this.consume(btn); this.taps.length = 0; return id; }
      }
    }
    return null;
  }

  // ---------------------------------------------------------------- state control
  setState(s) { if (this.state !== s) { this.state = s; this.sf = 0; } }
  get airborne() { return this.y > 0.01 || this.vy > 0.01; }
  get alive() { return !this.ko; }

  resetForRound(x, facing) {
    this.x = x; this.y = 0; this.vx = 0; this.vy = 0; this.facing = facing;
    this.hp = this.maxHp; this.ko = false;
    this.state = "intro"; this.sf = 0; this.move = null; this.mf = 0;
    this.hitstop = 0; this.stun = 0; this.invuln = 0; this.strikeInvuln = false; this.armored = false;
    this.throwInvuln = 0; this.airAttackUsed = false; this.hitIds.clear(); this.hitWindow = -1;
    this.combo = 0; this.comboDmg = 0; this.juggle = 0; this.kdOnLand = false;
    this.thrower = null; this.victim = null; this.throwPelvis = null;
    this.landLag = 0; this.shakeX = 0; this.background = false; this.kickV = 0;
    this.clearInput();
    this.anim.name = ""; this.vis = 1;
  }

  startMove(id) {
    const m = this.ch.moves[id];
    if (!m) return false;
    this.move = m; this.mf = 0; this.moveSerial++;
    this.state = m.def.throw ? "throw" : "attack"; this.sf = 0;
    this.hitIds.clear(); this.hitWindow = -1;
    this.moveHit = false; this.moveBlocked = false; this.contactFrame = -1;
    this.armorHits = 0;
    if (!m.air) this.vx = 0;
    if (m.special) this.game.sound("special");
    if (m.special || m.combo) this.game.fx("special", { seat: this.seat, id, name: m.name, ch: this.ch.id, combo: !!m.combo, x: this.x, color: this.ch.accent });
    return true;
  }

  endMove() {
    this.move = null; this.strikeInvuln = false; this.armored = false;
    this.vx = 0;
    this.setState(this.held & IN.DOWN ? "crouch" : "idle");
  }

  startSquat(dir) {
    this.setState("squat");
    this.jumpDir = dir;
    this.vx = 0;
  }

  takeoff() {
    const st = this.ch.stats;
    this.vy = st.jumpVy;
    this.vx = this.jumpDir * this.facing * st.jumpVx;
    this.y = 0.1;
    this.airAttackUsed = false;
    this.setState("air");
  }

  // ---------------------------------------------------------------- per-frame update
  step() {
    const g = this.game;
    this.readInput();
    if (!this.active) { this.sf++; this.idleT++; this.anim.t += this.anim.rate; return; }
    if (this.hitstop > 0) {
      this.hitstop--;
      // the one who got hit shudders while the action is frozen
      const shaking = this.hitstop > 0 && (this.state === "hitstun" || this.state === "launch" || this.state === "blockstun");
      this.shakeX = shaking ? (this.hitstop % 2 ? 1 : -1) * Math.min(2.6, 0.8 + this.hitstop * 0.13) * (this.state === "blockstun" ? 0.6 : 1) : 0;
      return;
    }
    this.shakeX = 0;
    if (this.invuln > 0) this.invuln--;
    if (this.throwInvuln > 0) this.throwInvuln--;
    this.sf++; this.idleT++; this.anim.t += this.anim.rate;
    const locked = g.phase !== "fight";
    switch (this.state) {
      case "intro": case "lobby":
        this.vx = 0;
        if (!locked) this.setState("idle");
        break;
      case "idle": case "walk": case "crouch": case "block": case "cblock":
        if (locked) { this.vx = 0; if (g.phase === "roundEnd" || g.phase === "matchEnd") this.maybeCelebrate(); break; }
        this.neutral();
        break;
      case "squat":
        if (!locked) { const sp = this.checkSpecial(); if (sp) { this.startMove(sp); break; } }
        if (this.sf >= 3) this.takeoff();
        break;
      case "air":
        if (!locked && !this.airAttackUsed) {
          if (this.hasPress(IN.PUNCH)) { this.consume(IN.PUNCH); this.airAttackUsed = true; this.startMove("airPunch"); }
          else if (this.hasPress(IN.KICK)) { this.consume(IN.KICK); this.airAttackUsed = true; this.startMove("airKick"); }
        }
        break;
      case "land":
        this.vx = 0;
        if (this.sf >= Math.max(3, this.landLag)) { this.landLag = 0; this.setState("idle"); }
        break;
      case "dash":
        this.vx = this.facing * this.ch.stats.dashV * (this.sf < 10 ? 1 : 0.4);
        if (!locked) {
          const sp = this.sf < 8 ? this.checkSpecial() : null;
          if (sp) { this.startMove(sp); break; }
          if (this.sf > 4 && this.hasPress(IN.PUNCH)) { this.consume(IN.PUNCH); this.startMove("straight"); break; }
        }
        if (this.sf >= 14) { this.vx = 0; this.setState("idle"); }
        break;
      case "backdash":
        this.vx = -this.facing * this.ch.stats.dashV * 0.8 * (this.sf < 10 ? 1 : 0.35);
        if (this.sf >= 15) { this.vx = 0; this.setState("idle"); }
        break;
      case "attack": case "throw":
        this.runMove();
        break;
      case "hitstun":
        if (--this.stun <= 0) this.recover();
        break;
      case "blockstun":
        this.blockLow = !!(this.held & IN.DOWN);
        if (--this.stun <= 0) this.recover();
        break;
      case "launch":
        break;   // handled by physics / landing
      case "down":
        this.vx *= 0.8;
        if (this.sf >= 30) { this.setState("getup"); this.invuln = 22; }
        break;
      case "getup":
        if (this.sf >= 18) { this.setState("idle"); this.invuln = 5; this.throwInvuln = 8; }
        break;
      case "ko":
        this.vx *= 0.85;
        break;
      case "thrown":
        break;
      case "victory": case "defeat":
        this.vx = 0;
        break;
    }
    this.physics();
  }

  recover() {
    this.stun = 0;
    if (this.state === "blockstun" && ((this.held & IN.BLOCK) || this.holdingBack())) {
      this.setState(this.held & IN.DOWN ? "cblock" : "block");
      this.guardLock = this.game.cfg.guardRecovery || 0;
      return;
    }
    this.setState(this.held & IN.DOWN ? "crouch" : "idle");
    if (this.state !== "hitstun") { this.combo = 0; this.comboDmg = 0; this.juggle = 0; }
  }

  maybeCelebrate() {
    const g = this.game;
    if (!this.ko && g.isWinnerTeam(this.team) && g.phaseT > 1.3 && !this.airborne) this.setState("victory");
    else if (!this.ko && g.phase === "matchEnd" && !g.isWinnerTeam(this.team) && g.phaseT > 1.3) this.setState("defeat");
  }

  neutral() {
    const g = this.game, st = this.ch.stats, h = this.held;
    const fwd = this.fwd(), back = this.back(), down = h & IN.DOWN;
    this.combo = 0; this.comboDmg = 0; this.juggle = 0;
    // tag team: hold BLOCK and press R to swap with the partner
    if (g.tagMode && (h & IN.BLOCK) && this.hasPress(IN.SPECIAL)) {
      this.consume(IN.SPECIAL);
      if (g.canTag(this)) { g.tagIn(this.team, g.partnerOf(this).seat, false); return; }
    }
    // specials first (they are deliberate inputs)
    const sp = this.checkSpecial();
    if (sp) { this.startMove(sp); return; }
    // throws
    const wantThrow = this.hasPress(IN.THROW) || (this.hasPress(IN.PUNCH) && fwd && !down);
    if (wantThrow) {
      const t = g.throwTarget(this);
      if (t) { this.consume(IN.THROW); this.consume(IN.PUNCH); this.startThrow(t); return; }
      if (this.hasPress(IN.THROW)) { this.consume(IN.THROW); this.startMove("throwWhiff"); return; }
    }
    if (this.hasPress(IN.PUNCH)) { this.consume(IN.PUNCH); this.startMove(down ? "uppercut" : fwd ? "straight" : "jab"); return; }
    if (this.hasPress(IN.KICK)) { this.consume(IN.KICK); this.startMove(down ? "sweep" : fwd ? "longKick" : back ? "roundhouse" : "kickMid"); return; }
    if (this.hasPress(IN.UP)) { this.consume(IN.UP); this.startSquat(fwd ? 1 : back ? -1 : 0); return; }
    // dashes: double tap
    const n = this.taps.length;
    if (n >= 2) {
      const a = this.taps[n - 2], b = this.taps[n - 1];
      if (b.f === g.frame && b.d === a.d && b.f - a.f <= 14 && (b.d === "F" || b.d === "B")) {
        // taps are kept so F,F + button can still become a special during the dash
        this.setState(b.d === "F" ? "dash" : "backdash");
        if (b.d === "B") this.invuln = Math.max(this.invuln, 7);
        g.fx("dust", { x: this.x - this.facing * (b.d === "F" ? 8 : -8), small: true }); g.sound("dash");
        return;
      }
    }
    // the block button guards in place; holding away walks back while guarding (crouching
    // with down-back guards low without moving). Right after blocking a hit the guard holds
    // still for a moment before the walk back resumes.
    if (this.guardLock > 0) this.guardLock--;
    const backGuard = back && this.game.cfg.backBlocks !== false;
    if ((h & IN.BLOCK) || (backGuard && (down || this.guardLock > 0))) { this.setState(down ? "cblock" : "block"); this.vx = 0; return; }
    if (down) { this.setState("crouch"); this.vx = 0; return; }
    if (fwd) { this.setState("walk"); this.vx = this.facing * st.walkF; return; }
    if (back) { this.setState("walk"); this.vx = -this.facing * st.walkB; return; }
    this.setState("idle"); this.vx = 0;
  }

  runMove() {
    const g = this.game, m = this.move;
    if (!m) { this.setState("idle"); return; }
    const f = ++this.mf;
    // forward movement windows (grounded moves only)
    if (!m.air && !(m.jump && f > m.jump.at)) {
      let vx = 0;
      for (const [a, b, v] of m.vel) if (f >= a && f <= b) vx = v;
      this.vx = this.facing * vx;
    }
    if (m.jump && f === m.jump.at) {
      this.vy = m.jump.vy; this.vx = this.facing * m.jump.vx; this.y = Math.max(this.y, 0.1);
    }
    if (m.projectile && f === m.projectile.at) g.spawnProjectile(this, m.projectile);
    if (m.teleport !== undefined && f === m.teleport) g.teleportBehind(this);
    this.strikeInvuln = !!(m.invuln && f >= m.invuln[0] && f <= m.invuln[1]);
    this.armored = !!(m.armor && f >= m.armor[0] && f <= m.armor[1]);
    if (m.hits.length && f === m.hits[0].from && !this.moveHit && !this.moveBlocked) g.sound(m.special || m.hits[0].snd === "heavy" ? "whiffh" : "whiff");
    if (this.state === "throw") this.driveVictim();
    // combo strings: each move can name the next link for P and K (a slot in the fighter's
    // combo table), taken hit or miss once the first strike has come out
    if (m.def.next && this.ch.combos && g.phase === "fight" && m.hits.length && f > m.hits[0].from) {
      const plain = !(this.held & IN.DOWN) && !this.fwd() && !this.back();
      const W = BUFFER + Math.max(10, this.lastStop + 3);   // a press during hitstop still counts
      const slot = !plain ? null : m.def.next.P && this.hasPress(IN.PUNCH, W) ? m.def.next.P : m.def.next.K && this.hasPress(IN.KICK, W) ? m.def.next.K : null;
      const id = slot && this.ch.combos[slot];
      if (id && this.ch.moves[id]) { this.consume(IN.PUNCH); this.consume(IN.KICK); this.startMove(id); return; }
    }
    // cancels and chains after contact
    if ((this.moveHit || this.moveBlocked) && f > this.contactFrame && g.phase === "fight") {
      if (m.cancel) {
        const sp = this.checkSpecial();
        if (sp) { this.startMove(sp); return; }
      }
      if (m.chain.length) {
        let next = null;
        const down = this.held & IN.DOWN, fwd = this.fwd(), back = this.back();
        if (this.hasPress(IN.PUNCH)) next = down ? "uppercut" : fwd ? "straight" : "jab";
        else if (this.hasPress(IN.KICK)) next = down ? "sweep" : fwd ? "longKick" : back ? "roundhouse" : "kickMid";
        if (next && m.chain.includes(next)) {
          this.consume(IN.PUNCH); this.consume(IN.KICK);
          this.startMove(next); return;
        }
      }
    }
    const airMove = m.air || (m.jump && f >= m.jump.at);
    if (!airMove && f >= m.total) this.endMove();
    else if (m.air && f >= m.total) { this.move = null; this.setState("air"); }
  }

  startThrow(t) {
    this.startMove("throw");
    this.victim = t;
    t.thrower = this;
    t.move = null;
    t.setState("thrown");
    t.vx = 0; t.vy = 0;
    t.techWindow = 7;
    t.facing = -this.facing;
    this.game.sound("heavy");
  }

  driveVictim() {
    const t = this.victim, m = this.move;
    if (!t) return;
    if (t.state !== "thrown" || t.thrower !== this) { this.victim = null; return; }
    // throw escape
    if (t.techWindow > 0) {
      t.techWindow--;
      if (t.hasPress(IN.THROW) || t.hasPress(IN.PUNCH)) {
        t.consume(IN.THROW); t.consume(IN.PUNCH);
        this.game.breakThrow(this, t);
        return;
      }
    }
    const f = this.mf, keys = m.victim;
    let a = keys[0], b = keys[keys.length - 1];
    for (let i = 1; i < keys.length; i++) if (f <= keys[i][0]) { a = keys[i - 1]; b = keys[i]; break; }
    const u = b[0] > a[0] ? smooth01((f - a[0]) / (b[0] - a[0])) : 1;
    const dx = lerp(a[1], b[1], u), dy = lerp(a[2], b[2], u), rot = lerp(a[3], b[3], u);
    t.throwPelvis = { x: this.x + this.facing * dx * this.ch.legF, y: dy * this.ch.legF, rot };
    t.x = t.throwPelvis.x; t.y = 0;
    if (f >= m.release) this.game.releaseThrow(this, t);
  }

  physics() {
    const g = this.game;
    if (this.state === "thrown") return;
    if (this.kickV) {
      this.x += this.kickV * DT;
      this.kickV *= 0.82;
      if (Math.abs(this.kickV) < 4) this.kickV = 0;
    }
    if (this.airborne) {
      this.vy -= (this.state === "launch" ? LAUNCH_GRAVITY : GRAVITY) * DT;
      this.x += this.vx * DT;
      this.y += this.vy * DT;
      if (this.y <= 0) { this.y = 0; this.vy = 0; this.onLand(); }
    } else {
      if (this.state === "hitstun" || this.state === "blockstun" || this.state === "getup") this.vx *= 0.86;
      this.x += this.vx * DT;
    }
    const lim = g.halfW - this.ch.stats.pushW;
    if (this.x < -lim) { this.x = -lim; if (this.vx < 0) this.vx = 0; }
    if (this.x > lim) { this.x = lim; if (this.vx > 0) this.vx = 0; }
  }

  onLand() {
    const g = this.game;
    if (this.state === "launch") {
      this.vx *= 0.4;
      if (this.ko) { this.setState("ko"); g.sound("kd"); g.shake(2); }
      else { this.setState("down"); this.juggle = 0; this.combo = 0; this.comboDmg = 0; g.sound("kd"); g.shake(1.2); }
      g.fx("dust", { x: this.x, ko: !!this.ko });
      return;
    }
    if (this.state === "attack" && this.move) {
      const lag = this.move.air ? 5 : (this.move.landLag || 6);
      this.move = null; this.strikeInvuln = false; this.armored = false;
      this.landLag = lag; this.vx = 0;
      this.setState("land");
      return;
    }
    if (this.state === "air" || this.state === "squat") {
      this.vx = 0; this.landLag = 3; this.setState("land");
      g.fx("dust", { x: this.x, small: true }); g.sound("land");
    }
  }

  // ---------------------------------------------------------------- animation
  // Which baked clip shows this fighter right now, how fast it plays (clip frames per sim
  // frame) and a key that changes whenever the clip must restart (a new move, a new hit).
  // The CS2 rig plays the same clip by name, so the model and the hit boxes stay together.
  clipName(key, ch = this.ch) {
    const set = CLIP_SETS[ch.id];
    if (!set) return "";
    return set[key] || set.idle || "";
  }
  animState() {
    const s = this.state;
    let key = "idle", speed = 1, restart = "", ch = this.ch;
    switch (s) {
      case "attack": case "throw":
        if (this.move) { key = this.move.id; restart = "m" + this.moveSerial; }
        break;
      case "intro": key = "intro"; break;
      case "lobby": key = this.lobbyReady ? "lobbyready" : "idle"; break;
      case "walk": {
        const fwd = Math.sign(this.vx) * this.facing >= 0;
        key = fwd ? "walkf" : "walkb";
        // walk clips are authored at the fighter's walking speed
        speed = Math.max(0.35, Math.abs(this.vx) / Math.max(1, fwd ? ch.stats.walkF : ch.stats.walkB));
        break;
      }
      case "crouch": case "block": case "cblock": case "squat": case "land": case "defeat": key = s; break;
      case "dash": key = "dashf"; break;
      case "backdash": key = "dashb"; break;
      case "air": key = this.vy > 150 ? "airrise" : "air"; break;
      case "hitstun":
        key = this.crouchHit ? "hitcrouch" : this.hitLevel === "high" ? "hithigh" : "hitmid";
        restart = "h" + this.hitSerial;
        break;
      case "blockstun": key = this.blockLow ? "cblockhit" : "blockhit"; restart = "b" + this.hitSerial; break;
      case "launch":
        if (this.sf < 20) { key = "launch"; restart = "l" + this.hitSerial; } else key = "launchhold";
        break;
      case "down": key = "down"; break;
      case "ko": key = "downko"; break;
      case "getup": key = "getup"; break;
      case "thrown":
        // the thrower's paired clip, played in the thrower's place and frame
        key = "throwv"; restart = "t" + this.hitSerial;
        if (this.thrower) ch = this.thrower.ch;
        break;
      case "victory": key = "victory"; break;
      case "waiting": key = this.cheering > 0 ? "cheer" : "waiting"; break;
    }
    const clip = this.clipName(key, ch);
    const c = CLIPS[clip];
    return { clip, rate: (c ? c.r : 1) * speed, key: clip + restart };
  }

  // ---------------------------------------------------------------- defence queries
  // Holding away from the opponent blocks too (when the game allows it), as in most fighters.
  holdingBack() { return this.game.cfg.backBlocks !== false && this.back(); }
  canBlock(level) {
    if (this.airborne || this.ko) return false;
    const s = this.state;
    const blocking = s === "block" || s === "cblock" || s === "blockstun" || (NEUTRAL.has(s) && ((this.held & IN.BLOCK) || this.holdingBack()));
    if (!blocking) return false;
    // standing guard: high and mid. Crouching guard: mid and low.
    const crouching = s === "cblock" || (s === "blockstun" ? this.blockLow : !!(this.held & IN.DOWN));
    if (level === "low") return crouching;
    if (level === "high" || level === "air" || level === "over") return !crouching;
    return true;
  }
  strikeable() {
    if (!this.active || this.ko || this.invuln > 0 || this.strikeInvuln) return false;
    if (this.state === "down" || this.state === "getup" || this.state === "thrown" || this.state === "victory") return false;
    if (this.state === "launch" && this.juggle >= MAX_JUGGLE) return false;
    return true;
  }
  throwable() {
    if (!this.active || this.ko || this.airborne || this.invuln > 0 || this.throwInvuln > 0 || this.strikeInvuln) return false;
    return NEUTRAL.has(this.state) || this.state === "land" || this.state === "dash";
  }
  overlaps(x, y, r) {
    for (const c of this.hurt) {
      if (distPointSeg(x, y, c[0], c[1], c[2], c[3]) <= r + c[4]) return true;
    }
    return false;
  }

  // Advances nothing (the clock ticks in step); picks up clip changes and rebuilds the body.
  animate() {
    const a = this.animState(), A = this.anim;
    if (a.clip !== A.name || a.key !== A.key) {
      A.name = a.clip; A.key = a.key; A.clip = CLIPS[a.clip] || null; A.t = 0;
    }
    A.rate = a.rate;
    // vanishing moves shrink the body away and back
    const m = this.move;
    this.vis = 1;
    if (m && m.scale && (this.state === "attack")) {
      const k = m.scale, f = this.mf;
      if (f >= k[0][0] && f <= k[k.length - 1][0]) {
        for (let i = 1; i < k.length; i++) if (f <= k[i][0]) {
          const u = k[i][0] > k[i - 1][0] ? (f - k[i - 1][0]) / (k[i][0] - k[i - 1][0]) : 1;
          this.vis = lerp(k[i - 1][1], k[i][1], smooth01(u));
          break;
        }
      }
    }
    if (this.cheering > 0) this.cheering--;
    this.buildRender();
  }

  // Baked joints -> stage-space render parts, hurt capsules and hitbox tips.
  buildRender() {
    const ch = this.ch, d = ch.dims, sk = this.sk, P = sk.pts, A = this.anim;
    let c = A.clip, t = A.t;
    let facing = this.facing, baseX = this.x + this.shakeX, baseY = this.y;
    const thrown = this.state === "thrown" && this.thrower;
    if (thrown) { t = this.thrower.mf * (c ? c.r : 1); facing = this.thrower.facing; baseX = this.thrower.x; baseY = 0; }
    if (!c) c = CLIPS[this.clipName("idle")] || null;
    const raw = sk.raw;
    if (c) sampleClip(c, t, raw);
    const sc = ch.scale * this.vis;
    for (let i = 0; i < JN; i++) { const q = P[JOINTS[i]]; q.x = raw[2 * i] * sc; q.y = raw[2 * i + 1] * sc; }
    // lowest surface point; an airborne body is lifted so it never dips into the floor
    const fr = d.fistR * this.vis, hr = d.headR * this.vis, footR = BLOCK_HALF_K * d.foot * this.vis + 0.2;
    let minY = Math.min(P.fA.y, P.bA.y, P.fT.y, P.bT.y) - footR;
    minY = Math.min(minY, P.H.y - hr, P.fF.y - fr, P.bF.y - fr, P.fK.y - 3, P.bK.y - 3, P.P.y - 6, P.N.y - 6, P.fE.y - 2, P.bE.y - 2);
    sk.minY = minY;
    this.lift = !thrown && baseY > 0 && baseY + minY < 0 ? -(baseY + minY) : 0;
    const oy = baseY + this.lift;
    const wx = (j) => baseX + facing * P[j].x, wy = (j) => oy + P[j].y;
    const body = this.color, low2 = shade(body, 0.78), acc = ch.accent;
    const far = (cl) => shade(cl, 0.8);
    const dk = d.torso / 31;
    // the lead limbs are on the far side of the body (the camera sees the fighter's rear side)
    const depthF = -12.5 * dk, depthL = -4.4 * dk;
    const base = this.depthBase;
    const hide = !this.onStage || this.vis < 0.06;
    const seg = (i, model, a, b, len, depth, color) => {
      const q = this.parts[i];
      q.model = model; q.x = wx(a); q.y = wy(a);
      const dx = wx(b) - q.x, dy = wy(b) - q.y;
      q.ang = Math.atan2(dy, dx) / DEG;
      q.len = Math.sqrt(dx * dx + dy * dy); q.r = 0;
      q.w = (model === "block" ? BLOCK_HALF_K : LIMB_RADIUS_K) * len * this.vis;
      q.depth = base + depth; q.color = color; q.hidden = hide;
    };
    const ball = (i, j, r, depth, color) => {
      const q = this.parts[i];
      q.model = "ball"; q.x = wx(j); q.y = wy(j); q.ang = 0; q.len = 0; q.r = r * this.vis;
      q.depth = base + depth; q.color = color; q.hidden = hide;
    };
    const L = ch.limb;
    seg(PART.TORSO, "block", "P", "N", d.torso, 0, body);
    ball(PART.HEAD, "H", d.headR, 0.5, acc);
    seg(PART.F_UARM, L, "S", "fE", d.uarm, depthF, far(body));
    seg(PART.F_FARM, L, "fE", "fW", d.farm, depthF, far(low2));
    ball(PART.F_FIST, "fF", d.fistR, depthF, far(acc));
    seg(PART.B_UARM, L, "S", "bE", d.uarm, -depthF, body);
    seg(PART.B_FARM, L, "bE", "bW", d.farm, -depthF, low2);
    ball(PART.B_FIST, "bF", d.fistR, -depthF, acc);
    seg(PART.F_THIGH, L, "P", "fK", d.thigh, depthL, far(body));
    seg(PART.F_SHIN, L, "fK", "fA", d.shin, depthL, far(low2));
    seg(PART.F_FOOT, "block", "fA", "fT", d.foot, depthL, far(acc));
    seg(PART.B_THIGH, L, "P", "bK", d.thigh, -depthL, body);
    seg(PART.B_SHIN, L, "bK", "bA", d.shin, -depthL, low2);
    seg(PART.B_FOOT, "block", "bA", "bT", d.foot, -depthL, acc);
    this.parts[PART.EXTRA0].hidden = true;
    this.parts[PART.EXTRA1].hidden = true;
    // hurt capsules [ax, ay, bx, by, r]
    const v = this.vis;
    const lr = (len) => limbRadius(ch, len) * v + 1;
    const H = this.hurt; H.length = 0;
    const cap = (a, b, r) => H.push([wx(a), wy(a), wx(b), wy(b), r]);
    cap("P", "N", d.torso * BLOCK_HALF_K * v + 1.5);
    cap("H", "H", d.headR * v + 1);
    cap("S", "fE", lr(d.uarm)); cap("fE", "fW", lr(d.farm)); cap("fF", "fF", d.fistR * v);
    cap("S", "bE", lr(d.uarm)); cap("bE", "bW", lr(d.farm)); cap("bF", "bF", d.fistR * v);
    cap("P", "fK", lr(d.thigh)); cap("fK", "fA", lr(d.shin)); cap("fA", "fT", lr(d.foot));
    cap("P", "bK", lr(d.thigh)); cap("bK", "bA", lr(d.shin)); cap("bA", "bT", lr(d.foot));
    // tips
    const T = this.tips;
    const tip = (name, x, y) => { const tt = T[name] || (T[name] = { x: 0, y: 0 }); tt.x = x; tt.y = y; };
    tip("fF", wx("fF"), wy("fF")); tip("bF", wx("bF"), wy("bF"));
    tip("fT", lerp(wx("fA"), wx("fT"), TIP_FRACTION), lerp(wy("fA"), wy("fT"), TIP_FRACTION));
    tip("bT", lerp(wx("bA"), wx("bT"), TIP_FRACTION), lerp(wy("bA"), wy("bT"), TIP_FRACTION));
    tip("fK", wx("fK"), wy("fK")); tip("bK", wx("bK"), wy("bK"));
    tip("S", wx("S"), wy("S")); tip("H", wx("H"), wy("H"));
    this.top = Math.max(wy("H") + d.headR, wy("fF"), wy("bF"));
  }

  tipFor(h) {
    if (h.tip === "G") return { x: this.x + this.facing * h.gx * this.ch.legF, y: h.gy };
    const t = this.tips[h.tip];
    return t ? { x: t.x, y: t.y } : { x: this.x, y: 50 };
  }
}
