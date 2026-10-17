"""Writes the custom_hud_layout files: panorama/layout/custom_game/puppet_brawl.xml + styles css.
Panel ids and classes here must match what scripts/puppet_brawl.js sets.

Layout rules (CS2's Panorama is touchy): one 1080-high screen; every panel has a fixed size and is
pinned from the top and the left, centre or right; no vertical centring, no negative margins, no
boxes that size to their children; panels show and hide by opacity. Classes the script switches
all start with "st" and none of them has a rule of its own, only in combination with a panel's
class. Nothing sits where CS2 draws its own HUD over a custom one (team counter top centre, kill
feed top right from y 72, chat bottom left, money / health along the bottom); tools/hud_preview.py
checks all of this and draws the HUD over the arena preview.
Usage: python3 make_hud.py <addon_dir>"""
import os, sys
OUT = sys.argv[1] if len(sys.argv) > 1 else "dist/addon"

TICKS = "".join('<Panel class="Tick" hittest="false" />' for _ in range(10))


def card(n, side, row2=False):
    cls = "Card %s%s" % (side, " Row2" if row2 else "")
    return f"""		<Panel id="pb_c{n}" class="{cls}" hittest="false">
			<Panel class="Stripe" hittest="false" />
			<Panel class="Bar" hittest="false">
				<Panel id="pb_c{n}_chip" class="Chip w100" hittest="false" />
				<Panel id="pb_c{n}_fill" class="Fill w100" hittest="false" />
				<Panel class="Shine" hittest="false" />
				<Panel class="Ticks" hittest="false">{TICKS}</Panel>
			</Panel>
			<Panel class="NamePlate" hittest="false" />
			<Label id="pb_c{n}_name" class="CardName" text="{{s:t}}" />
			<Label id="pb_c{n}_fighter" class="CardFighter" text="{{s:t}}" />
			<Label class="YouTag" text="YOU" />
			<Panel class="Pips" hittest="false">
				<Panel id="pb_c{n}_pip1" class="Pip" hittest="false" />
				<Panel id="pb_c{n}_pip2" class="Pip" hittest="false" />
				<Panel id="pb_c{n}_pip3" class="Pip Pip3" hittest="false" />
			</Panel>
		</Panel>"""


def combo(n, side):
    return f"""		<Panel id="pb_k{n}" class="Combo {side}" hittest="false">
			<Label id="pb_k{n}_tag" class="ComboTag" text="{{s:t}}" />
			<Label id="pb_k{n}_hits" class="ComboHits" text="{{s:t}}" />
			<Label class="ComboWord" text="HITS" />
			<Label id="pb_k{n}_sub" class="ComboSub" text="{{s:t}}" />
		</Panel>"""


XML = f"""<root>
	<styles>
		<include src="file://{{resources}}/styles/custom_game/puppet_brawl.css" />
	</styles>

	<Panel class="PBRoot" hittest="false">
	<Panel id="pb_game" class="Screen stHidden" hittest="false">
{card(1, "Left")}
{card(2, "Right")}
{card(3, "Left", True)}
{card(4, "Right", True)}
{combo(1, "Left")}
{combo(2, "Right")}
		<Panel class="Clock" hittest="false">
			<Panel class="TimerPlate" hittest="false" />
			<Label id="pb_timer" class="Timer" text="{{s:t}}" />
		</Panel>
		<Label id="pb_round" class="RoundText" text="{{s:t}}" />
		<Label id="pb_queue" class="Queue" text="{{s:t}}" />

		<Label id="pb_announce" class="Announce" text="{{s:t}}" />

		<Panel id="pb_lobby" class="Lobby" hittest="false">
			<Panel class="Hazard" hittest="false" />
			<Label class="LobbyTitle" text="PUPPET BRAWL" />
			<Label class="LobbyTag" text="NIGHT MARKET  //  NO RULES  //  NO STRINGS ATTACHED" />
			<Label id="pb_lobby_mode" class="LobbyMode" text="{{s:t}}" />
			<Label id="pb_lobby_s1" class="LobbyRow R1" text="{{s:t}}" />
			<Label id="pb_lobby_s2" class="LobbyRow R2" text="{{s:t}}" />
			<Label id="pb_lobby_s3" class="LobbyRow R3" text="{{s:t}}" />
			<Label id="pb_lobby_s4" class="LobbyRow R4" text="{{s:t}}" />
			<Label id="pb_lobby_count" class="LobbyCount" text="{{s:t}}" />
			<Label id="pb_lobby_hint" class="LobbyHint" text="{{s:t}}" />
			<Label id="pb_keys" class="LobbyKeys" text="{{s:t}}" />
			<Panel class="Hazard Bottom" hittest="false" />
		</Panel>

		<Panel id="pb_mebox" class="MeBox" hittest="false">
			<Panel class="Hazard Thin" hittest="false" />
			<Label id="pb_me" class="MeLine" text="{{s:t}}" />
			<Label id="pb_moves" class="MeMoves" text="{{s:t}}" />
			<Label id="pb_motions" class="MeMotions" text="{{s:t}}" />
			<Label id="pb_status" class="MeStatus" text="{{s:t}}" />
		</Panel>

		<Panel id="pb_pill" class="Pill" hittest="false">
			<Label id="pb_pill_text" class="PillText" text="{{s:t}}" />
		</Panel>

		<Panel id="pb_joinhint" class="JoinHint" hittest="false">
			<Label id="pb_joinhint_text" class="JoinHintText" text="{{s:t}}" />
		</Panel>
	</Panel>
	</Panel>
</root>
"""

COLORS = ["#e0302a", "#2f86ff", "#46b83a", "#f0b21c", "#ff7a26", "#2cc4d0"]

CSS = """/* Puppet Brawl HUD - driven by scripts/puppet_brawl.js through custom_hud_layout pb_hud.
   Back-alley arcade: hard-edged charcoal plates, heavy black outlines, fire health bars,
   an amber-framed clock and big slanted callouts. */

.PBRoot { width: 100%; height: 100%; }
.Screen {
	width: 100%; height: 1080px;
	font-family: Stratum2;
	opacity: 1;
	transition-property: opacity; transition-duration: 0.25s;
}
.Screen.stHidden { opacity: 0; }

@keyframes 'pb-throb' { 0% { opacity: 1; } 50% { opacity: 0.55; } 100% { opacity: 1; } }
@keyframes 'pb-pop' { 0% { pre-transform-scale2d: 1.45; } 100% { pre-transform-scale2d: 1; } }

/* ---------------------------------------------------------------- health bars, top left and right
   (they stop short of CS2's team counter in the middle and above its kill feed on the right) */
.Card {
	width: 570px; height: 70px;
	margin-top: 2px;
	opacity: 0;
	transition-property: opacity; transition-duration: 0.2s;
}
.Card.Left { horizontal-align: left; margin-left: 24px; }
.Card.Right { horizontal-align: right; margin-right: 24px; }
.Card.stShow { opacity: 1; }
.Card.stShow.stKO { opacity: 0.45; }
.Card.stShow.stBench { opacity: 0.6; }

/* seat colour: a cap on the outer end of the bar */
.Stripe { width: 10px; height: 36px; margin-top: 4px; background-color: #ffffff; border-right: 2px solid #000000; }
.Card.Right .Stripe { horizontal-align: right; border-right: 0px solid #000000; border-left: 2px solid #000000; }

/* health: blood-dark trough, white-hot damage chip that drains after a beat, fire fill, ticks */
.Bar {
	width: 552px; height: 30px;
	margin-left: 12px; margin-top: 4px;
	background-color: gradient( linear, 0% 0%, 0% 100%, from( #2c0706 ), to( #110202 ) );
	border: 3px solid #000000;
	box-shadow: #000000aa 3px 4px 0px 0px;
}
.Card.Right .Bar { horizontal-align: right; margin-left: 0px; margin-right: 12px; }
.Card.stMe .Bar { border: 3px solid #f0b21c; }
.Fill, .Chip { height: 30px; horizontal-align: left; }
.Card.Right .Fill, .Card.Right .Chip { horizontal-align: right; }
.Chip { background-color: #fff2cc; transition-property: width; transition-duration: 0.6s; transition-delay: 0.4s; transition-timing-function: ease-out; }
.Fill {
	background-color: gradient( linear, 0% 0%, 0% 100%, from( #ffd25a ), color-stop( 0.42, #f2661c ), to( #a01408 ) );
	transition-property: width; transition-duration: 0.08s;
}
.Card.stLow .Fill {
	background-color: gradient( linear, 0% 0%, 0% 100%, from( #ff6a4a ), color-stop( 0.45, #cc180e ), to( #5e0402 ) );
	animation-name: pb-throb; animation-duration: 0.7s; animation-iteration-count: infinite;
}
.Shine { width: 552px; height: 9px; background-color: #ffffff26; }
.Ticks { width: 552px; height: 30px; flow-children: right; }
.Tick { width: 10%; height: 30px; border-right: 2px solid #00000088; }

/* the name plate under the bar: player name, fighter, YOU */
.NamePlate {
	width: 400px; height: 26px;
	margin-left: 12px; margin-top: 40px;
	background-color: gradient( linear, 0% 0%, 0% 100%, from( #1e1c1af2 ), to( #070707f2 ) );
	border: 2px solid #000000;
}
.Card.Right .NamePlate { horizontal-align: right; margin-left: 0px; margin-right: 12px; }
.CardName {
	width: 230px; height: 26px;
	margin-left: 24px; margin-top: 42px;
	font-size: 21px; font-weight: black; color: #ffffff;
	text-transform: uppercase; letter-spacing: 2px;
	text-shadow: 2px 2px 0px 1.0 #000000;
}
.Card.Right .CardName { horizontal-align: right; margin-left: 0px; margin-right: 24px; text-align: right; }
.CardFighter {
	width: 116px; height: 20px;
	margin-left: 260px; margin-top: 45px;
	font-size: 12px; font-weight: bold; color: #1a1714; text-align: center;
	background-color: #c8bca4; padding-top: 2px;
	border: 1px solid #000000; letter-spacing: 2px; text-transform: uppercase;
}
.Card.Right .CardFighter { horizontal-align: right; margin-left: 0px; margin-right: 260px; }
.YouTag {
	width: 40px; height: 20px;
	margin-left: 380px; margin-top: 45px;
	font-size: 12px; font-weight: black; color: #0c0a06; text-align: center;
	background-color: #f0b21c; padding-top: 2px;
	border: 1px solid #000000; letter-spacing: 2px;
	opacity: 0;
}
.Card.Right .YouTag { horizontal-align: right; margin-left: 0px; margin-right: 380px; }
.Card.stMe .YouTag { opacity: 1; }

/* round wins: hard diamonds at the inner end, under the bar */
.Pips { width: 96px; height: 22px; horizontal-align: right; margin-right: 6px; margin-top: 44px; flow-children: left; }
.Card.Right .Pips { horizontal-align: left; margin-right: 0px; margin-left: 6px; flow-children: right; }
.Pip {
	width: 13px; height: 13px; margin-left: 8px; margin-right: 8px; margin-top: 3px;
	background-color: #2a2622; border: 2px solid #000000;
	transform: rotateZ( 45deg );
}
.Pip.stWon { background-color: #ff6a1e; border: 2px solid #ffd27a; box-shadow: #ff3a0a99 0px 0px 6px 1px; }
.Pip3 { opacity: 0; }
.Card.stNeed3 .Pip3 { opacity: 1; }

/* tag team: the partner's slim bar under the kill feed's corner */
.Card.Row2 { width: 400px; height: 46px; margin-top: 196px; }
.Card.Row2 .Stripe { width: 8px; height: 16px; }
.Card.Row2 .Bar { width: 374px; height: 12px; margin-left: 10px; border: 2px solid #000000; }
.Card.Row2.Right .Bar { margin-right: 10px; }
.Card.Row2 .Fill, .Card.Row2 .Chip { height: 12px; }
.Card.Row2 .Shine { width: 374px; height: 4px; }
.Card.Row2 .Ticks { width: 374px; height: 12px; }
.Card.Row2 .Tick { height: 12px; }
.Card.Row2 .NamePlate { width: 374px; height: 22px; margin-left: 10px; margin-top: 20px; }
.Card.Row2.Right .NamePlate { margin-right: 10px; }
.Card.Row2 .CardName { width: 190px; height: 22px; margin-left: 18px; margin-top: 21px; font-size: 16px; }
.Card.Row2.Right .CardName { margin-right: 18px; }
.Card.Row2 .CardFighter { width: 170px; height: 16px; margin-left: 212px; margin-top: 23px; font-size: 11px; padding-top: 1px; letter-spacing: 1px; }
.Card.Row2.Right .CardFighter { margin-right: 212px; }
.Card.Row2 .YouTag, .Card.Row2 .Pips { opacity: 0; width: 0px; height: 0px; margin-top: 0px; }

/* ---------------------------------------------------------------- combo callouts under the cards */
.Combo {
	width: 460px; height: 160px;
	margin-top: 252px;
	opacity: 0;
	transition-property: opacity; transition-duration: 0.12s;
}
.Combo.Left { horizontal-align: left; margin-left: 30px; }
.Combo.Right { horizontal-align: right; margin-right: 30px; }
.Combo.stShow { opacity: 1; }
.ComboTag {
	width: 460px; height: 38px;
	font-size: 30px; font-weight: black; color: #ffffff; letter-spacing: 3px; text-transform: uppercase;
	text-shadow: 3px 3px 0px 1.0 #000000;
	opacity: 0;
}
.Combo.Right .ComboTag { text-align: right; }
.Combo.stTag .ComboTag { opacity: 1; animation-name: pb-pop; animation-duration: 0.18s; }
.Combo.stCounter .ComboTag { color: #ffd23a; }
.Combo.stPerfect .ComboTag { color: #8ff4ff; }
.Combo.stFinish .ComboTag { color: #ff9a3a; }
.ComboHits {
	width: 150px; height: 104px; margin-top: 34px;
	font-size: 86px; font-weight: black; color: #ff8a1e; text-align: right;
	text-shadow: 5px 5px 0px 1.0 #000000;
	opacity: 0;
}
.ComboWord {
	width: 130px; height: 46px; margin-left: 158px; margin-top: 70px;
	font-size: 36px; font-weight: black; color: #f6ead0; letter-spacing: 2px;
	text-shadow: 3px 3px 0px 1.0 #000000;
	opacity: 0;
}
.Combo.Right .ComboHits { horizontal-align: right; margin-right: 138px; }
.Combo.Right .ComboWord { horizontal-align: right; margin-left: 0px; margin-right: 0px; text-align: right; }
.Combo.stHits .ComboHits, .Combo.stHits .ComboWord { opacity: 1; }
.ComboSub {
	width: 460px; height: 26px; margin-top: 132px;
	font-size: 19px; font-weight: bold; color: #e9dcc0; letter-spacing: 2px; text-transform: uppercase;
	text-shadow: 2px 2px 0px 1.0 #000000;
	opacity: 0;
}
.Combo.Right .ComboSub { text-align: right; }
.Combo.stHits .ComboSub { opacity: 1; }

/* ---------------------------------------------------------------- the clock, under CS2's team counter */
.Clock { width: 136px; height: 80px; horizontal-align: center; margin-top: 70px; opacity: 0; }
.Screen.stMatch .Clock { opacity: 1; }
.TimerPlate {
	width: 128px; height: 72px;
	background-color: gradient( linear, 0% 0%, 0% 100%, from( #1f1d1bf6 ), to( #050505f6 ) );
	border: 4px solid #000000;
	box-shadow: #f0b21cbb 0px 0px 0px 3px;
}
.Timer {
	width: 136px; height: 76px; margin-top: 2px;
	font-size: 64px; font-weight: black; color: #f6e4ba; text-align: center;
	text-shadow: 3px 3px 0px 1.0 #000000;
}
.Timer.stLow { color: #ff4a2a; animation-name: pb-throb; animation-duration: 0.5s; animation-iteration-count: infinite; }
.RoundText {
	width: 300px; height: 24px; horizontal-align: center; margin-top: 156px;
	font-size: 18px; font-weight: black; color: #f0b21c; text-align: center; letter-spacing: 4px;
	text-shadow: 2px 2px 0px 1.0 #000000;
	opacity: 0;
}
.Screen.stMatch .RoundText { opacity: 1; }
.Queue {
	width: 760px; height: 24px; horizontal-align: center; margin-top: 182px;
	font-size: 17px; font-weight: bold; color: #d9cdb2; text-align: center; letter-spacing: 2px; text-transform: uppercase;
	text-shadow: 2px 2px 0px 1.0 #000000;
}

/* ---------------------------------------------------------------- announcer */
.Announce {
	width: 100%; height: 230px; margin-top: 300px;
	font-size: 112px; font-weight: black; color: #f6ead0;
	text-align: center; letter-spacing: 6px; text-transform: uppercase;
	text-shadow: 7px 7px 0px 1.0 #000000;
	opacity: 0;
	pre-transform-scale2d: 1.6;
	transition-property: opacity, pre-transform-scale2d; transition-duration: 0.12s; transition-timing-function: ease-in;
}
.Announce.stShow { opacity: 1; pre-transform-scale2d: 1; }
.Announce.stFight { color: #ff7a1a; font-size: 150px; margin-top: 286px; pre-transform-rotate2d: -4deg; }
.Announce.stKo { color: #e8160e; font-size: 184px; margin-top: 270px; letter-spacing: 14px; pre-transform-rotate2d: -6deg; text-shadow: 9px 9px 0px 1.0 #000000; }
.Announce.stWin { font-size: 86px; margin-top: 318px; color: #ffcf5a; }
.Announce.stSub { font-size: 46px; margin-top: 420px; color: #d9cdb2; letter-spacing: 4px; text-shadow: 4px 4px 0px 1.0 #000000; }
.Announce.stSmall { font-size: 44px; margin-top: 360px; letter-spacing: 3px; color: #ffd27a; text-shadow: 4px 4px 0px 1.0 #000000; }

/* ---------------------------------------------------------------- lobby: a steel plate */
.Lobby {
	width: 1000px; height: 500px;
	horizontal-align: center; margin-top: 96px;
	background-color: gradient( linear, 0% 0%, 0% 100%, from( #2b2c2ef4 ), color-stop( 0.08, #1a1b1df4 ), to( #08090af4 ) );
	border: 4px solid #000000;
	box-shadow: #000000cc 6px 7px 0px 0px;
	opacity: 0;
	transition-property: opacity; transition-duration: 0.2s;
}
.Screen.stLobby .Lobby { opacity: 1; }
.Hazard {
	width: 992px; height: 10px;
	background-color: gradient( linear, 0% 0%, 100% 0%, from( #f0b21c ), color-stop( 0.5, #c27a10 ), to( #f0b21c ) );
	border-bottom: 3px solid #000000;
}
.Hazard.Bottom { margin-top: 478px; height: 6px; }
.LobbyTitle {
	width: 992px; height: 72px; margin-top: 18px;
	font-size: 60px; font-weight: black; color: #ff7a1a; letter-spacing: 10px; text-align: center;
	text-shadow: 5px 5px 0px 1.0 #000000;
}
.LobbyTag { width: 992px; height: 22px; margin-top: 92px; font-size: 15px; font-weight: bold; color: #8e8778; letter-spacing: 4px; text-align: center; }
.LobbyMode {
	width: 560px; height: 34px; horizontal-align: center; margin-top: 122px;
	font-size: 22px; font-weight: bold; color: #0c0a06; letter-spacing: 3px; text-align: center;
	background-color: #f0b21c; padding-top: 4px; border: 2px solid #000000;
}
.LobbyRow {
	width: 940px; height: 40px; horizontal-align: center;
	font-size: 22px; color: #77716a; padding-top: 7px; padding-left: 12px;
	background-color: #00000066; border-left: 5px solid #2e2b28; text-transform: uppercase; letter-spacing: 1px;
}
.LobbyRow.R1 { margin-top: 168px; }
.LobbyRow.R2 { margin-top: 212px; }
.LobbyRow.R3 { margin-top: 256px; }
.LobbyRow.R4 { margin-top: 300px; }
.LobbyRow.stTaken { color: #efe6d2; border-left: 5px solid #8e8778; }
.LobbyRow.stReady { color: #9cf07a; border-left: 5px solid #46b83a; }
.LobbyRow.stMe { font-weight: black; }
.LobbyCount { width: 992px; height: 34px; margin-top: 352px; font-size: 26px; font-weight: black; color: #ff8a1e; letter-spacing: 2px; text-align: center; text-shadow: 3px 3px 0px 1.0 #000000; }
.LobbyHint { width: 992px; height: 24px; margin-top: 392px; font-size: 18px; color: #a59d8d; letter-spacing: 1px; text-align: center; }
.LobbyKeys { width: 960px; height: 46px; horizontal-align: center; margin-top: 424px; font-size: 16px; font-weight: bold; color: #d9cdb2; letter-spacing: 1px; text-align: center; }

/* ---------------------------------------------------------------- your fighter, bottom right */
.MeBox {
	width: 880px; height: 236px;
	horizontal-align: right; margin-right: 24px; margin-top: 744px;
	background-color: gradient( linear, 0% 0%, 0% 100%, from( #1f1e1df0 ), to( #060606f0 ) );
	border: 3px solid #000000;
	box-shadow: #000000cc 5px 6px 0px 0px;
	opacity: 0;
	transition-property: opacity; transition-duration: 0.2s;
}
.Screen.stPick .MeBox { opacity: 1; }
.Hazard.Thin { width: 874px; height: 5px; border-bottom: 2px solid #000000; }
.MeLine { width: 840px; height: 30px; margin-left: 18px; margin-top: 14px; font-size: 22px; color: #ffffff; font-weight: black; letter-spacing: 2px; text-transform: uppercase; }
.MeMoves { width: 840px; height: 52px; margin-left: 18px; margin-top: 50px; font-size: 19px; color: #ddd3bd; }
.MeMotions { width: 840px; height: 80px; margin-left: 18px; margin-top: 104px; font-size: 15px; color: #958d7e; }
.MeStatus { width: 840px; height: 30px; margin-left: 18px; margin-top: 192px; font-size: 21px; color: #ff8a1e; font-weight: black; letter-spacing: 2px; text-transform: uppercase; }

/* ---------------------------------------------------------------- your status during a match (tag team) */
.Pill {
	width: 700px; height: 44px;
	horizontal-align: center; margin-top: 932px;
	background-color: #070707e6;
	border: 2px solid #f0b21c;
	opacity: 0;
	transition-property: opacity; transition-duration: 0.15s;
}
.Screen.stStatus .Pill { opacity: 1; }
.PillText { width: 696px; height: 40px; padding-top: 8px; font-size: 20px; font-weight: black; color: #ffcf5a; text-align: center; letter-spacing: 2px; text-transform: uppercase; }

/* ---------------------------------------------------------------- join prompt */
.JoinHint {
	width: 760px; height: 58px;
	horizontal-align: center; margin-top: 690px;
	background-color: #070707ee;
	border: 3px solid #f0b21c;
	box-shadow: #000000cc 5px 6px 0px 0px;
	opacity: 0;
	transition-property: opacity; transition-duration: 0.15s;
}
.JoinHint.stShow { opacity: 1; }
.JoinHintText { width: 754px; height: 52px; padding-top: 10px; font-size: 28px; font-weight: black; color: #ffcf5a; letter-spacing: 3px; text-align: center; text-shadow: 2px 2px 0px 1.0 #000000; }
"""


def main():
    lay = os.path.join(OUT, "panorama", "layout", "custom_game"); os.makedirs(lay, exist_ok=True)
    sty = os.path.join(OUT, "panorama", "styles", "custom_game"); os.makedirs(sty, exist_ok=True)
    with open(os.path.join(lay, "puppet_brawl.xml"), "w", newline="\n") as f: f.write(XML)
    css = CSS
    css += "\n/* seat colours (stCol0-3 seats, stCol4-5 second team colours) */\n"
    for i, c in enumerate(COLORS):
        css += f".Card.stCol{i} .Stripe {{ background-color: {c}; }}\n.Card.stCol{i} .NamePlate {{ border-bottom: 2px solid {c}; }}\n"
    css += "\n/* health widths set by the script */\n"
    for w in range(101):
        css += f".w{w} {{ width: {w}%; }}\n"
    with open(os.path.join(sty, "puppet_brawl.css"), "w", newline="\n") as f: f.write(css)
    print("hud written")


if __name__ == "__main__":
    main()
