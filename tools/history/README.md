# Earlier map passes

One-off passes that were applied to earlier Hammer saves of `mg_cs2_fighter.vmap`, kept for the record.
`make_map.py` generated the first version of the map; the others patched Hammer saves after that
(sign facings, effect templates and the stage text, bigger host buttons, the STOP CPUs button).
The current look of the map comes from `tools/arena.py`.

They import `dmx9` from `tools/`, so run them as `PYTHONPATH=tools python3 tools/history/<pass>.py <in.vmap> <out.vmap>`.
