# Contact sheet of given PNGs (fit each into a cell), labelled.
import sys
from PIL import Image, ImageDraw
out, cell, cols, files = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4:]
rows = (len(files)+cols-1)//cols
sheet = Image.new('RGB', (cols*cell, rows*(cell+16)), (200,200,200))
d = ImageDraw.Draw(sheet)
for i,f in enumerate(files):
    im = Image.open(f).convert('RGBA'); im.thumbnail((cell-6, cell-6))
    x, y = (i%cols)*cell, (i//cols)*(cell+16)
    bg = Image.new('RGBA', im.size, (255,255,255,255)); bg.alpha_composite(im)
    sheet.paste(bg.convert('RGB'), (x+3, y+3))
    d.text((x+3, y+cell), __import__('os').path.basename(f)[:28]+' '+str(Image.open(f).size), fill=(0,0,0))
sheet.save(out, quality=85)
