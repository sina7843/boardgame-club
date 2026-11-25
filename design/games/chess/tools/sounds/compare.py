import subprocess, sys
REF = {  # chess.com measurements 2026-11-24: duration s, env10ms[0:6], octave bands first 30 ms
 'move-self': (0.075, [-20,-33,-47,-57,-59,-62], [-24,-10,0,0,-5,-25,-45,-52]),
 'move-opponent': (0.074, [-23,-35,-48,-60,-62,-65], None),
 'capture': (0.133, [-20,-24,-31,-42,-49,-53], [-28,-10,-8,-4,0,-12,-18,-25]),
 'castle': (0.165, [-35,-42,-45,-34,-41,-39], [-23,-6,0,0,-3,-20,-40,-46]),
 'move-check': (0.139, [-29,-19,-34,-45,-57,-59], [-29,-26,-13,0,0,-7,-8,-15]),
 'promote': (0.132, [-34,-46,-47,-49,-51,-26], [-29,-8,-4,0,-1,-15,-36,-51]),
 'game-start': (0.138, [-15,-38,-69,-71,-69,-73], None),
 'game-end': (0.141, [-16,-62,-68,-70,-72,-72], None),
 'low-time': (0.42, [-23,-18,-29,-44,-50,-57], None),
 'illegal': (0.242, [-28,-16,-21,-14,-19,-20], [-26,-6,0,0,-12,-32,-36,-39]),
 'premove': (0.103, [-27,-35,-40,-47,-56,-63], None),
 'notify': (0.181, [-25,-21,-23,-25,-26,-26], None),
}
sys.path.insert(0, '.')
import analyze_files as A
from pathlib import Path
d = Path(sys.argv[1])
for name, (rd, renv, rob) in REF.items():
    dur, cen, pk, env, ob = A.feats(A.decode(d / f'{name}.mp3'), name)
    ober = '' if not rob else f' octErr {sum(abs(a-b) for a,b in zip(ob,rob))/8:4.1f}dB  ours {ob} ref {rob}'
    print(f'{name:14s} dur {dur:.3f}/{rd:.3f}  env {env[:6]} ref {renv}{ober}')
