"""Original geometric preparation diagrams/clips. No third-party footage or real junction claim.
Run with Pillow installed and FFMPEG_PATH pointing to an installed FFmpeg binary.
"""
from pathlib import Path
import hashlib, json, math, os, subprocess
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "api/content/learning-media"
OUT.mkdir(parents=True, exist_ok=True)
FONT = Path("C:/Windows/Fonts/arial.ttf")
def font(size):
    try: return ImageFont.truetype(str(FONT), size)
    except OSError: return ImageFont.load_default()
LESSONS = {
    "observation": ("Observation & anticipation", ["Look ahead and notice the setting.", "Discuss mirror and blind-spot checks.", "Choose one observation focus together."], ["Kijk vooruit en bekijk de situatie.", "Bespreek spiegels en dode hoeken.", "Kies samen een aandachtspunt."]),
    "junctions": ("Preparing for junctions", ["Notice the junction layout ahead.", "Review the signs and visibility.", "Discuss a calm approach with your supervisor."], ["Bekijk de indeling van het kruispunt.", "Bespreek borden en zichtbaarheid.", "Bespreek een rustige nadering."]),
    "roundabouts": ("Preparing for roundabouts", ["Study the approach before your drive.", "Review the actual signs and lane layout.", "Discuss the planned exit with your supervisor."], ["Bestudeer de nadering voor je rit.", "Bekijk actuele borden en rijstroken.", "Bespreek de geplande uitrit."]),
    "lane-planning": ("Observation before changing position", ["Notice the road layout and other users.", "Discuss mirrors, blind spots and space.", "Review your plan before moving."], ["Bekijk de weg en andere weggebruikers.", "Bespreek spiegels, dode hoeken en ruimte.", "Bespreek je plan voor vertrek."]),
}
def frame(key, title, prompts, t):
    im = Image.new("RGB", (640,360), "#eff7f1"); d=ImageDraw.Draw(im)
    d.text((24,16), "DRIVE COACH / VISUAL PREPARATION",font=font(12), fill="#277561")
    d.text((24,38),title,font=font(23),fill="#12392f")
    d.rounded_rectangle((20,78,620,280),radius=18,fill="#deece3")
    if key=="roundabouts":
        d.rectangle((285,78,355,280),fill="#60776e"); d.rectangle((170,143,470,213),fill="#60776e")
        d.ellipse((234,111,406,253),fill="#60776e"); d.ellipse((270,145,370,219),fill="#bddcb8")
        targets=[(310,260),(240,175),(430,175)]
    elif key=="junctions":
        d.rectangle((285,78,355,280),fill="#60776e");d.rectangle((130,143,510,213),fill="#60776e")
        targets=[(320,175),(265,136),(380,228)]
    else:
        d.rectangle((230,78,410,280),fill="#60776e")
        for y in range(85,280,34):d.line((320,y,320,y+17),fill="#f4f1d8",width=3)
        targets=[(365,110),(275,182),(415,230)]
    d.rounded_rectangle((340,204,374,263),radius=8,fill="#f98b35",outline="white",width=2)
    d.rounded_rectangle((345,214,369,230),radius=3,fill="#234a40")
    phase=min(2,int(t/2.7)); x,y=targets[phase]; radius=16+int(4*math.sin(t*4))
    d.ellipse((x-radius,y-radius,x+radius,y+radius),outline="#ffcd66",width=4)
    d.line((357,215,x,y),fill="#c7e7d6",width=2)
    d.text((26,293),f"0{phase+1}  {prompts[phase]}",font=font(17),fill="#173f34")
    d.text((26,327),"GENERIC ILLUSTRATION / NOT THIS LOCATION / REVIEW WHILE PARKED",font=font(10),fill="#536d60")
    return im

manifest={"version":1,"source":"Original Drive Coach project diagrams, generated from geometric drawing code.","rights":"Original project media; permitted for use and adaptation within Drive Coach. No third-party photos, route recordings or branding.","locationEvidence":False,"audio":False,"durationSeconds":8,"lessons":[]}
for key,(title,en,nl) in LESSONS.items():
    frame(key,title,en,1.5).save(OUT/f"{key}.png",optimize=True)
    args=[os.environ["FFMPEG_PATH"],"-hide_banner","-loglevel","error","-y","-f","rawvideo","-pix_fmt","rgb24","-s","640x360","-r","12","-i","pipe:0","-an","-c:v","libx264","-preset","fast","-crf","25","-pix_fmt","yuv420p","-movflags","+faststart",str(OUT/f"{key}.mp4")]
    proc=subprocess.Popen(args,stdin=subprocess.PIPE)
    try:
        for i in range(96):proc.stdin.write(frame(key,title,en,i/12).tobytes())
        proc.stdin.close()
        if proc.wait()!=0:raise RuntimeError("Video encoding failed")
    finally:
        if proc.poll() is None:proc.kill()
    for lang,lines in [("en",en),("nl",nl)]:
        text="WEBVTT\n\n"+"\n\n".join(f"{a} --> {b}\n{line}" for a,b,line in zip(["00:00.000","00:02.700","00:05.400"],["00:02.700","00:05.400","00:08.000"],lines))+"\n"
        (OUT/f"{key}.{lang}.vtt").write_bytes(text.encode("utf-8"))
    files=[p for p in OUT.iterdir() if p.name.startswith(key+".")]
    manifest["lessons"].append({"id":key,"title":title,"transcriptEn":en,"transcriptNl":nl,"files":[{"name":p.name,"sha256":hashlib.sha256(p.read_bytes()).hexdigest(),"bytes":p.stat().st_size} for p in sorted(files)]})
(OUT/"manifest.json").write_bytes((json.dumps(manifest,indent=2)+"\n").encode("utf-8"))
print(json.dumps({"lessons":len(LESSONS),"totalBytes":sum(p.stat().st_size for p in OUT.iterdir()),"originalOnly":True}))
