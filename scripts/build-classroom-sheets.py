"""Build printable CIRC classroom sheets without reading private class records."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import simpleSplit

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'guides'
NAVY, BLUE, TEAL, LINE = map(HexColor, ['#15364f', '#175fb5', '#087c7a', '#b9cddd'])

def text(c, value, x, y, width=510, size=11, leading=16, bold=False):
    font = 'Helvetica-Bold' if bold else 'Helvetica'
    c.setFont(font, size)
    c.setFillColor(NAVY)
    for line in simpleSplit(value, font, size, width):
        c.drawString(x, y, line)
        y -= leading
    return y

def header(c, grade, title, subtitle, detail='Name: ______________________________  Class: ______________'):
    c.setFillColor(BLUE); c.rect(0, 740, 612, 52, fill=1, stroke=0)
    c.setFillColor(HexColor('#ffffff')); c.setFont('Helvetica-Bold', 14)
    c.drawString(42, 759, 'CIRC HQ  |  LEARN TOGETHER')
    c.drawRightString(570, 759, f'GRADE {grade}')
    text(c, title, 42, 708, size=23, bold=True)
    text(c, subtitle, 42, 683, size=11)
    text(c, detail, 42, 649)

def line(c, y):
    c.setStrokeColor(LINE); c.line(42, y, 570, y)

def footer(c, value):
    line(c, 51); text(c, value, 42, 34, size=9)

def build_basket_card():
    path = OUT / 'CIRC-Basket-Build.pdf'
    c = canvas.Canvas(str(path), pagesize=(612, 792), invariant=1)
    c.setTitle('Basket Build - Make something useful')
    header(c, 6, 'Basket Build', 'Make something useful with the materials in your basket.',
           '35 minutes   |   Who will use your invention, and what job will it do?')

    steps = [
        ('5 min', 'Choose', 'Everyone offers an idea. Pick one user and one job your invention can do.'),
        ('5 min', 'Demo and plan', 'Watch the cutter demo. Decide how you will test your idea and share the work.'),
        ('14 min', 'Build', 'Everyone makes or tests a part. Use the chopsticks, felt or other basket materials that help your idea work.'),
        ('7 min', 'Swap, test and improve', 'Let another team try the job. Watch what happens, change one thing and try again.'),
        ('4 min', 'Show and reset', 'Give a 30-second demo. Name one thing a teammate contributed. Return tools and clear your space.'),
    ]
    for index, (duration, title, prompt) in enumerate(steps):
        y = 606 - index * 63
        line(c, y + 18)
        text(c, duration, 42, y, size=12, bold=True)
        text(c, title, 111, y, size=13, bold=True)
        text(c, prompt, 111, y - 19, width=450, size=11, leading=14)

    line(c, 308)
    text(c, 'Need an idea?', 42, 283, size=14, bold=True)
    text(c, 'Pencil dock', 42, 260, bold=True)
    text(c, 'Keep a pencil from rolling off a desk.', 140, 260)
    text(c, 'Cargo sling', 42, 241, bold=True)
    text(c, 'Carry a tape roll across the table without dropping it.', 140, 241)
    text(c, 'Sign stand', 42, 222, bold=True)
    text(c, 'Hold a cardboard direction sign upright, hands-free.', 140, 222)

    c.setFillColor(HexColor('#eaf3f5'))
    c.roundRect(42, 121, 528, 77, 6, fill=1, stroke=0)
    text(c, 'At the tool stations', 55, 175, size=13, bold=True)
    text(c, 'Use cardboard cutters after your teacher demonstrates them. Use the ChompSaw for cardboard. Hot glue stays at open, supervised stations. Use tape at your table.',
         55, 155, width=495, size=11, leading=15)
    text(c, 'At your demo', 42, 91, size=13, bold=True)
    text(c, '"It helps ___ do ___. Watch it work. After testing, we changed ___."', 42, 70)
    footer(c, 'CIRC HQ  |  Grade 6 team challenge')
    c.save()
    return path

def build():
    OUT.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(OUT/'CIRC-Tank-First-Idea.pdf'), pagesize=(612,792), invariant=1)
    c.setTitle('CIRC Tank - One sketch and a 30-second pitch')
    header(c, 6, 'CIRC Tank: your first idea', 'Today: brainstorm, make ONE labeled sketch, and pitch to Mr. Macek.')
    text(c, '1  WHO NEEDS HELP, AND WHAT IS THE PROBLEM?', 42, 613, bold=True)
    text(c, 'I want to help __________________ when _________________________.', 42, 589)
    text(c, '2  DRAW ONE IDEA. LABEL THE PARTS THAT HELP.', 42, 550, bold=True)
    c.setStrokeColor(LINE); c.roundRect(42, 262, 528, 267, 8, fill=0, stroke=1)
    text(c, '3  GET YOUR 30-SECOND PITCH READY', 42, 234, bold=True)
    for y, value in [(208,'My idea helps ______________________________________________.'),(179,'The problem is _____________________________________________.'),(150,'My idea works by ___________________________________________.'),(121,'__________________________________________________________.')]: text(c,value,42,y)
    text(c, 'Check: one labeled sketch + pitch to Mr. Macek before you leave.',42,83,bold=True)
    footer(c, 'No essay, second sketch, survey or finished build is due in this opening lesson.')
    c.save()

    c = canvas.Canvas(str(OUT/'CIRC-Quick-Draw-Observations.pdf'), pagesize=(612,792), invariant=1)
    c.setTitle('CIRC Quick Draw - Notice a detail')
    header(c, 5, 'Quick Draw: notice a detail', 'Investigate the guesses. Specific observations matter more than a score.')
    text(c, 'ONE DRAWING IT RECOGNIZED',42,610,bold=True)
    text(c, 'Object: __________________  A detail that helped: _________________',42,583)
    line(c,557)
    text(c, 'ONE DRAWING IT MISSED (OR TOOK LONGER TO GUESS)',42,516,bold=True)
    text(c, 'Object: __________________  I would try changing: __________________',42,489)
    line(c,463)
    text(c, 'SHOW THE DETAIL YOU WOULD KEEP OR CHANGE',42,422,bold=True)
    c.setStrokeColor(LINE);c.roundRect(42,247,528,154,8,fill=0,stroke=1)
    text(c, 'TELL A PARTNER',42,218,bold=True)
    text(c, 'I noticed ____________________ when I added ___________________.',42,191)
    text(c, 'NO WEBSITE? USE PAPER.',42,151,bold=True)
    text(c, 'Take turns drawing a simple object while a partner guesses. Add one detail and try again. Explain what changed. These are human guesses, not AI results.',42,130,size=10,leading=15)
    footer(c, 'Draw objects only. Leave out names and personal information. Written response only if assigned.')
    c.save()
    return [OUT/'CIRC-Tank-First-Idea.pdf', OUT/'CIRC-Quick-Draw-Observations.pdf', build_basket_card()]

if __name__ == '__main__':
    for path in build(): print(path.name)
