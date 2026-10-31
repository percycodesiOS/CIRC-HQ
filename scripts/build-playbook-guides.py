"""Build the public annual guide and projection cards from current lesson data.

Derived from the maintained classroom packet builder. This script writes ONLY
these two curriculum PDFs. It never reads a private schedule or school records.
Run with Python containing reportlab and pypdf. Optional --out selects a folder.
"""
from pathlib import Path
import argparse, html, json, re, subprocess
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, landscape
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle, PageBreak, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from pypdf import PdfReader, PdfWriter

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--out',type=Path)
args=parser.parse_args()
HQ=Path(__file__).resolve().parents[1]
WORK=(args.out or HQ/'assets'/'guides').resolve()
WORK.mkdir(parents=True,exist_ok=True)
NAVY=colors.HexColor('#123348'); BLUE=colors.HexColor('#1768a2'); LIGHT=colors.HexColor('#eef5f8'); GREEN=colors.HexColor('#26704d')
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='BodyC',fontName='Helvetica',fontSize=10,leading=14,spaceAfter=7,textColor=NAVY))
styles.add(ParagraphStyle(name='SmallC',fontName='Helvetica',fontSize=8.5,leading=11,spaceAfter=4,textColor=NAVY))
styles.add(ParagraphStyle(name='HeadC',fontName='Helvetica-Bold',fontSize=19,leading=23,spaceAfter=12,textColor=NAVY))
styles.add(ParagraphStyle(name='SubC',fontName='Helvetica-Bold',fontSize=12,leading=16,spaceBefore=10,spaceAfter=6,textColor=BLUE))
styles.add(ParagraphStyle(name='TableC',fontName='Helvetica',fontSize=8.3,leading=10.5,textColor=NAVY))
def clean(v):
    return str(v).replace('\u2014',' - ').replace('\u2013','-').replace('\u2011','-').replace('\u2019',"'").replace('\u2018',"'").replace('\u201c','"').replace('\u201d','"')
def p(t,style='BodyC'):return Paragraph(html.escape(clean(t)).replace('\n','<br/>'),styles[style])
def hp(t):return p(t,'HeadC')
def sub(t):return p(t,'SubC')
def table(rows,widths):
    t=Table([[p(c,'TableC') for c in row] for row in rows],colWidths=widths,repeatRows=1,hAlign='LEFT')
    t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),LIGHT),('VALIGN',(0,0),(-1,-1),'TOP'),('LINEBELOW',(0,0),(-1,0),1,BLUE),('LINEBELOW',(0,1),(-1,-1),.3,colors.HexColor('#ccdce5')),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),7)]))
    return t
def footer(c,d):
    c.saveState();c.setFont('Helvetica',8);c.setFillColor(NAVY)
    c.drawString(40,24,'CIRC | Grades 5-6 | October 31, 2026')
    c.drawRightString(d.pagesize[0]-40,24,str(d.page));c.restoreState()
def pdf(path,story):
    path.parent.mkdir(parents=True,exist_ok=True)
    SimpleDocTemplate(str(path),pagesize=letter,rightMargin=40,leftMargin=40,topMargin=40,bottomMargin=40,title=path.stem,author='CIRC').build(story,onFirstPage=footer,onLaterPages=footer)
def section(story,title,lines):
    story.append(sub(title))
    if isinstance(lines,str):lines=[lines]
    for s in lines:
        if s:story.append(p(s))

js="""import{PLAYBOOKS,listMeetings,getLessonForRef,pathLabel}from'./src/model/playbooks.js';
const refs=[...new Set(PLAYBOOKS.flatMap(b=>listMeetings(b.id).flatMap(m=>Object.values(m.paths))))];
console.log(JSON.stringify({books:PLAYBOOKS.map(b=>({...b,meetings:listMeetings(b.id).map(m=>({...m,choices:Object.entries(m.paths).map(([path,ref])=>({path,label:pathLabel(path),ref,title:getLessonForRef(ref).title}))}))})),lessons:refs.map(ref=>getLessonForRef(ref))}));"""
data=json.loads(subprocess.check_output(['node','--input-type=module','-e',js],cwd=HQ,text=True,encoding='utf-8'))
assert len(data['lessons'])==74
assert all(l['minutes']==35 for l in data['lessons'])
lesson_number={l['ref']:i+1 for i,l in enumerate(data['lessons'])}

# Teacher guide: route first, followed by one copy of each shared lesson.
story=[hp('CIRC | The current teaching guide'),p('Playbook A 2026-27 + Playbook B 2027-28'),p('Open the route for your class. Find its lesson number below. Each complete lesson has 35-minute steps, teacher prompts, materials, evidence, adaptations and cleanup. Print only the lesson you need.'),p('A has 31 meetings plus a buffer, including completed NeuroArt. B has 35 meetings plus a buffer. Shared lessons appear once. Grade 5 does KidWind and innovation; Grade 6 does CIRC Tank. This is not 74 extra meetings.'),p('The lesson text comes directly from the same CIRC HQ source as the on-screen student and teacher views. The separate Classroom Toolkit covers Circuit Rescue, the logo-to-jingle companion and the optional NeuroArt finish check.'),p('Dates and actual class progress stay with the teacher. No student names, class lists or private schedule are included.'),PageBreak()]
for b in data['books']:
    story += [hp(b['name']+' | '+b['year']),p(b['capacity'])]
    rows=[['Visit','Unit / season','Lesson number and path']]
    for m in b['meetings']:
        rows.append([m['number'],m['unit']+' / '+m['season'],'\n'.join(f"L{lesson_number[c['ref']]:02d} {c['label']}: {c['title']}" for c in m['choices'])])
    story += [table(rows,[35,147,350]),PageBreak()]
for i,l in enumerate(data['lessons'],1):
    story += [hp(f'L{i:02d} | '+l['title']),p('GOAL: '+l['goal']),p('35 minutes. Lesson reference: '+l['ref'],'SmallC')]
    section(story,'Before students arrive',l['prep'])
    section(story,'Materials','; '.join(l['materials']))
    section(story,'Safety',l['safety'])
    if l['prepRequired']:section(story,'Prepare and test this first',l['prepRequired'])
    story.append(sub('Run the period'))
    elapsed=0
    for step in l['steps']:
        block=[p(f"{elapsed:02d}-{elapsed+step['minutes']:02d} min | {step['label']}",'SubC'),p('Students: '+' '.join(step['directions']))]
        if step['teacherDirections']:block.append(p('Teacher: '+' '.join(step['teacherDirections']),'SmallC'))
        story.append(KeepTogether(block));elapsed+=step['minutes']
    section(story,'What to collect or hear',l['turnIn'])
    section(story,'Success check',l['success'])
    section(story,'Support and stretch',[k.replace('grade5','Grade 5').replace('grade6','Grade 6').capitalize()+': '+v for k,v in l['adapt'].items()])
    section(story,'Another way to do it',l['fallback'])
    section(story,'Optional next challenge',l['extension'])
    section(story,'Cleanup',l['cleanup'])
    section(story,'Teacher notes',l['teacherNotes'])
    if l['paperPath']:
        pp=l['paperPath'];section(story,'Complete paper path',pp['directions']);section(story,'Paper evidence',pp['evidence']);section(story,'Practice data',pp['data']['label']);story.append(table([pp['data']['columns']]+pp['data']['rows'],[100,150,94,94,94]))
    if i<len(data['lessons']):story.append(PageBreak())
guide=WORK/'CIRC-Teacher-Guide.pdf';pdf(guide,story)
reader=PdfReader(guide);writer=PdfWriter();writer.append(reader,import_outline=False)
for index,page in enumerate(reader.pages):
    for line in page.extract_text().splitlines():
        if re.match(r'^L\d{2} \| ',line):writer.add_outline_item(line,index)
        elif line in ('Playbook A | 2026-27','Playbook B | 2027-28'):writer.add_outline_item(line,index)
with guide.open('wb') as f:writer.write(f)

# Projector cards: large text, one step per page. Bookmark the lesson in the PDF.
cards=WORK/'CIRC-Classroom-Cards.pdf'
c=canvas.Canvas(str(cards),pagesize=landscape(letter));W,H=landscape(letter)
def card(title,lines,kicker='',tail=''):
    c.setFillColor(LIGHT);c.rect(0,0,W,H,fill=1,stroke=0)
    c.setFillColor(BLUE);c.rect(0,H-58,W,58,fill=1,stroke=0)
    c.setFillColor(colors.white);c.setFont('Helvetica-Bold',14);c.drawString(35,H-35,clean(kicker)[:108])
    titlep=Paragraph(html.escape(clean(title)),ParagraphStyle('CT',fontName='Helvetica-Bold',fontSize=27,leading=32,textColor=NAVY));_,th=titlep.wrap(W-70,H);titlep.drawOn(c,35,H-78-th)
    y=H-96-th
    for line in lines:
        cp=Paragraph(html.escape(clean(line)),ParagraphStyle('CP',fontName='Helvetica',fontSize=23,leading=30,textColor=NAVY,spaceAfter=15))
        _,height=cp.wrap(W-86,H)
        assert y-height>=62,(title,line,y,height)
        cp.drawOn(c,43,y-height);y-=height+17
    c.setFont('Helvetica',11);c.setFillColor(NAVY);c.drawString(35,25,clean(tail)[:115]);c.drawRightString(W-35,25,str(c.getPageNumber()));c.showPage()
card('One step at a time',['Open the lesson from the PDF bookmarks.','Your teacher starts and advances the timer.','Use the Classroom Toolkit for Circuit Rescue, the logo-to-jingle companion and the NeuroArt finish check.'],'CIRC | Current Playbooks A and B','October 31, 2026 | Same lesson directions as CIRC HQ')
for i,l in enumerate(data['lessons'],1):
    key=f'lesson-{i}';c.bookmarkPage(key);c.addOutlineEntry(f'L{i:02d} '+clean(l['title']),key,level=0)
    card(l['title'],[l['goal']],f'L{i:02d} | Goal | 35 minutes','Teacher guide lesson '+f'L{i:02d}')
    for j,s in enumerate(l['steps'],1):
        # Preserve every direction; split crowded steps into readable continuation cards.
        chunks=[];group=[];chars=0
        for line in s['directions']:
            if group and (len(group)>=3 or chars+len(line)>390):chunks.append(group);group=[];chars=0
            group.append(line);chars+=len(line)
        if group:chunks.append(group)
        for k,chunk in enumerate(chunks):
            card(s['label']+(' (continued)' if k else ''),chunk,f"L{i:02d} | Step {j} of {len(l['steps'])} | {s['minutes']} minutes",l['title'])
    card('Show your learning',[l['turnIn']],f'L{i:02d} | Finish check',l['title'])
c.save()


print(json.dumps({'lessons':len(data['lessons']),'guide_pages':len(PdfReader(guide).pages),'card_pages':len(PdfReader(cards).pages),'outputs':[str(guide),str(cards)]},indent=2))
