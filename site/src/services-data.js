export const services = [
  { id:'film', title:'Shape a cinematic idea', short:'Film & animation', question:'You have a story. What does it look and feel like?', description:'Turn a premise into a shared visual direction before committing to a full production.', outputs:['Creative treatment & visual references','Style exploration and a look-development guide','Sequence outline & storyboard direction'], ai:'AI-assisted image exploration can help compare visual directions. Human review keeps character, tone and story intention coherent.', handoff:'A direction package your creative team can discuss, test and refine.', input:'A premise, intended audience and a few visual references.' },
  { id:'workflow', title:'Build a creative workflow', short:'AI & systems', question:'Your tools should work together. So should your team.', description:'Map a recurring production problem and prototype a practical workflow around it.', outputs:['Workflow map & tool-selection criteria','Prompt templates and review checkpoints','A small pilot with handoff documentation'], ai:'Agent workflows can support repeatable research, organisation and draft preparation. Define review gates before actions reach the production pipeline.', handoff:'A tested pilot and a clear plan for adoption, not an unreviewed automation.', input:'One recurring task, example inputs and your current tools.' },
  { id:'production', title:'Bring a production into focus', short:'Production clarity', question:'Where does the project slow down, and why?', description:'Make ownership, dependencies and the next decisions visible across a complex project.', outputs:['Pipeline and handoff audit','Milestone map & responsibility matrix','Review rhythm and delivery checklist'], ai:'AI can assist with organising notes and drafting summaries. The team validates priorities, schedules and final delivery decisions.', handoff:'A practical map of what happens next, who owns it and how it is reviewed.', input:'Your current pipeline, milestones and the biggest bottleneck.' },
  { id:'world', title:'Create a world with continuity', short:'Worldbuilding', question:'A world becomes believable when its details agree.', description:'Connect story logic, visual identity and a reference archive into a consistent creative foundation.', outputs:['World rules & narrative foundations','Character, environment and tone guide','A structured reference and decision archive'], ai:'Generative tools can explore variations and organise references. Editorial choices define canon; consistency is checked against the world guide.', handoff:'A world bible that gives future stories a common language.', input:'Your central idea, desired tone and what makes the world distinctive.' },
]
export const phases = [
  {id:'idea',label:'An early idea',detail:'Start by defining the audience, ambition and the smallest useful exploration.'},
  {id:'development',label:'In development',detail:'Review existing material, identify the gaps and test a focused next step.'},
  {id:'production',label:'Already in production',detail:'Protect ongoing delivery. Start with one bottleneck and a contained pilot.'},
]
export function makeBrief(service, phase) {
  return `I would like to discuss: ${service.short}.\nProject stage: ${phase.label}.\n\nPotential deliverables:\n${service.outputs.map(o => `- ${o}`).join('\n')}\n\nProject context:\n[Audience, ambition, current tools and timing]\n\nPreferred next step: a scoping conversation.`
}
export function serviceDraft(location) {
  const query = new URLSearchParams(location.split('?')[1])
  const service = services.find(s => s.id === query.get('focus'))
  if (!service) return ''
  return makeBrief(service, phases.find(p => p.id === query.get('stage')) || phases[0])
}
