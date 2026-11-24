export const profileUrl = 'https://www.linkedin.com/in/ialirezaaa/'
export const email = 'asgarpour.alireza@gmail.com'
export const routes = [
  ['/', 'Identity', 'The person behind the worlds'],
  ['/about', 'The director', 'Practice & perspective'],
  ['/work', 'The archive', 'Selected animation work'],
  ['/systems', 'Neural atlas', 'Projects, ideas & connections'],
  ['/contact', 'Transmission', 'Begin a conversation'],
]

export const projects = [
  { id:'dolphin', title:'Dolphin Boy 2', kind:'Series', date:'Oct 2023 – Jan 2025', role:'Production coordination & AI campaign', text:'A long-form animation production where planning, team alignment and deadline control kept the pipeline moving. The related promotional campaign tested AI across research, execution, localisation, music and narrative design.', discipline:'Production', note:'The goal was not to add a tool. It was to make the whole pipeline more capable.' },
  { id:'dragon', title:'Princess & The Dragon', kind:'Animation', date:'Project record', role:'Status audit & crisis coordination', text:'An outsourced international project entered during a company merger. I audited scattered files, exposed documentation gaps, stabilised production meetings and helped two teams work from a clearer shared picture.', discipline:'Production', note:'When a pipeline is under pressure, visibility is the first intervention.' },
  { id:'parkophobia', title:'PARKOPHOBIA', kind:'Teaser', date:'Project record', role:'AI-assisted pre-production', text:'A teaser project used to test how AI could accelerate early exploration without losing authorship. Its core question is practical: how do you compare visual possibilities while keeping one creative intention intact?', discipline:'AI & design', note:'Exploration gets faster when the criteria for selection are explicit.' },
  { id:'savior', title:'Savior Ship', kind:'Feature', date:'Jan 2023', role:'Feature animation project', text:'A feature animation project listed on the public profile. Detailed role and contribution information remain confidential, so this record is intentionally concise.', discipline:'Production', note:'Not every production belongs in the open archive.' },
  { id:'babatoto', title:'Babatoto', kind:'Series', date:'Apr 2021 – Dec 2022', role:'Assistant director & post-production', text:'Started as a small 2D production and later shifted toward a more international visual target. I led the art department bridge to technical teams, worked around Moho constraints, then directed musical segments and post-production after the director’s departure.', discipline:'Direction', note:'Creative leadership often means translating between art, technology and time.' },
  { id:'dandelions', title:'Dandelions', kind:'Series', date:'Jun 2018 – Apr 2021', role:'Assistant director & writer', text:'A formative writing and structure project: more than 61 episodes written, with 312 episodes rewritten and storyboarded under supervision to create a coherent series flow.', discipline:'Direction', note:'Story structure is production infrastructure.' },
  { id:'maryam', title:'Holy Land: Mary', kind:'Series', date:'Project record', role:'Assistant art direction', text:'An early series experience in which modelling, concept design, texturing, creative brainstorming and pre-production planning met the realities of a shared animation pipeline.', discipline:'Direction', note:'The craft and the process develop together.' },
  { id:'reporter', title:'Reporter', kind:'Animation', date:'Dec 2017 – Jan 2018', role:'First animation production', text:'The first professional step into animation: a one-month deadline, rapid scheduling, department coordination and a first experience leading a team under supervision.', discipline:'Direction', note:'Every practice has a first frame.' },
]

const projectNode = (id, label, x, y) => ({
  id, label, x, y, group:'project', description:projects.find(project => project.id === id).text,
})

export const graphNodes = [
  { id:'hades', label:'HADES', x:400, y:256, group:'realm', description:'A personal framework connecting narrative, production and creative intelligence.' },
  { id:'production', label:'Production', x:240, y:188, group:'practice', description:'The architecture that carries an idea through teams, revisions and delivery.' },
  { id:'intelligence', label:'AI workflows', x:547, y:169, group:'practice', description:'Choose tools deliberately. Creative value comes from how they fit the work.' },
  { id:'narrative', label:'Worldbuilding', x:473, y:375, group:'practice', description:'Myth, memory and character become the rules of a cinematic world.' },
  projectNode('dolphin', 'Dolphin Boy', 150, 289),
  projectNode('dragon', 'Princess & Dragon', 225, 84),
  projectNode('parkophobia', 'PARKOPHOBIA', 637, 271),
  projectNode('savior', 'Savior Ship', 127, 164),
  projectNode('maryam', 'Maryam', 314, 402),
  projectNode('reporter', 'Reporter', 188, 379),
  { id:'mythos', label:'Mythos', x:574, y:425, group:'realm', description:'The story archive: symbols, archetypes and rules that give a world continuity.' },
  { id:'orpheus', label:'Orpheus', x:616, y:100, group:'realm', description:'An envisioned orchestration layer within the Hades ecosystem.' },
  { id:'memory', label:'Production memory', x:375, y:79, group:'idea', description:'Preserve the reason behind each decision, not just its final output.' },
  { id:'style', label:'Style continuity', x:654, y:358, group:'idea', description:'A shared visual language that holds across tools, artists and iterations.' },
  { id:'review', label:'Human judgement', x:459, y:104, group:'idea', description:'Review, select and refine. Tools support the creative decision.' },
  { id:'story', label:'Story architecture', x:405, y:449, group:'idea', description:'Structure, rhythm and intention before spectacle.' },
]
export const graphEdges = [
  ['hades','production'],['hades','intelligence'],['hades','narrative'],['production','intelligence'],['intelligence','narrative'],['narrative','production'],
  ['production','dolphin'],['production','dragon'],['production','savior'],['production','reporter'],['production','memory'],
  ['intelligence','parkophobia'],['intelligence','orpheus'],['intelligence','review'],['intelligence','style'],['review','memory'],
  ['narrative','mythos'],['narrative','maryam'],['narrative','story'],['narrative','style'],['dolphin','style'],['dragon','memory'],
  ['parkophobia','style'],['maryam','reporter'],['mythos','story'],['orpheus','memory'],['hades','review'],
]
