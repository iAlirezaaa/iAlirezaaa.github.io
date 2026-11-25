// Shared editorial vocabulary. IDs are URL contracts; changing visible labels
// must not rename published category/tag routes or rewrite article prose.
export const categories = {
  papers: {
    name: 'خوانش پژوهش',
    description: 'از ایدهٔ مقاله تا روش و محدودیت‌هایش؛ با ارجاع به پژوهش اصلی.',
    prompt: 'یک پژوهش را بهتر بفهم',
  },
  'repo-analysis': {
    name: 'ابزارها و کد',
    description: 'سازوکار ابزارهای متن‌باز، مسیر اجرای کد و نکته‌هایی برای استفاده در کار واقعی.',
    prompt: 'پشت‌صحنهٔ یک ابزار را ببین',
  },
  fundamentals: {
    name: 'مبانی و مفاهیم',
    description: 'مفهوم‌های پایه، تنظیم‌ها و پرسش‌هایی که فهم روش‌ها را آسان‌تر می‌کنند.',
    prompt: 'از یک مفهوم شروع کن',
  },
}

export const topics = {
  'ai-basics': {
    name: 'مبانی هوش مصنوعی',
    description: 'واژه‌ها و ایده‌هایی برای شروع و روشن‌کردن پیش‌نیازها.',
    group: 'models', aliases: ['پایه‌های هوش مصنوعی', 'AI basics', 'مفهوم'],
  },
  diffusion: {
    name: 'مدل‌های دیفیوژن',
    description: 'از نویز و فضای نهفته تا فرایند ساخت تصویر.',
    group: 'models', aliases: ['دیفیوژن', 'انتشار', 'diffusion'],
  },
  'ai-image-making': {
    name: 'ساخت تصویر',
    description: 'ساختن تصویر با مدل‌های مولد و انتخاب‌های مؤثر بر نتیجه.',
    group: 'making', aliases: ['تصویرسازی با هوش مصنوعی', 'تصویرسازی', 'AI image making'],
  },
  'character-continuity': {
    name: 'ثبات شخصیت',
    description: 'حفظ ویژگی‌های یک شخصیت یا سوژه در تصویرهای متفاوت.',
    group: 'making', aliases: ['راکورد', 'تداوم شخصیت', 'character continuity', 'character consistency'],
  },
  animation: {
    name: 'انیمیشن',
    description: 'اصول حرکت، روایت، طراحی، دوربین، پیش‌تولید و اجرای انیمیشن.',
    group: 'making', aliases: ['Animation', 'پویانمایی'],
  },
  'frame-interpolation': {
    name: 'فریم‌های میانی',
    description: 'ساخت فریم بین دو تصویر و مسئله‌های حرکت و پوشیدگی.',
    group: 'making', aliases: ['میان‌یابی فریم', 'حرکت', 'frame interpolation'],
  },
  'image-control': {
    name: 'کنترل تصویر',
    description: 'هدایت مدل با متن، نقشهٔ عمق و تنظیم‌های تولید.',
    group: 'making', aliases: ['هدایت تصویر', 'کنترل تولید تصویر', 'conditioning'],
  },
  dreambooth: {
    name: 'DreamBooth',
    description: 'شخصی‌سازی مدل تصویر با چند نمونه از یک سوژه و بررسی حفظ ویژگی‌هایش.',
    group: 'models', aliases: ['دریم‌بوث', 'دریم بوث', 'dream booth'],
  },
  rife: {
    name: 'RIFE',
    description: 'ساخت فریم میانی با برآورد حرکت و بررسی مسئلهٔ پوشیدگی در تصویر.',
    group: 'tools', aliases: ['رایف', 'Real-Time Intermediate Flow Estimation'],
  },
  cfg: {
    name: 'هدایت CFG',
    description: 'اثر شدت راهنمایی متن بر نمونه‌گیری مدل دیفیوژن و کیفیت تصویر.',
    group: 'models', aliases: ['CFG', 'Classifier-Free Guidance', 'هدایت بدون طبقه‌بند'],
  },
  controlnet: {
    name: 'ControlNet',
    description: 'راهنمایی ساخت تصویر با ورودی‌هایی مانند نقشهٔ عمق برای حفظ ساختار قاب.',
    group: 'models', aliases: ['کنترل‌نت', 'کنترل نت', 'control net'],
  },
  'depth-map': {
    name: 'نقشهٔ عمق',
    description: 'نمایش فاصلهٔ نسبی بخش‌های صحنه برای راهنمایی ساختار تصویر.',
    group: 'making', aliases: ['عمق', 'depth map', 'depth estimation'],
  },
  ddpm: {
    name: 'DDPM',
    description: 'یادگیری حذف نویز و نمونه‌سازی تدریجی برای رسیدن به ساختار تصویر.',
    group: 'models', aliases: ['Denoising Diffusion Probabilistic Models', 'روش DDPM'],
  },
  comfyui: {
    name: 'ComfyUI',
    description: 'نودها، اجرای گراف و ساخت گردش‌کارهای تولید تصویر.',
    group: 'tools', aliases: ['کامفی یو آی', 'کامفی', 'comfy ui'],
  },
  workflow: {
    name: 'گردش‌کار ساخت',
    description: 'وصل‌کردن ابزارها و مرحله‌ها از ورودی تا خروجی.',
    group: 'tools', aliases: ['گردش‌کار', 'گردش کار', 'workflow', 'پایپ‌لاین'],
  },
  python: {
    name: 'پایتون',
    description: 'خواندن کد و فرمان‌های ابزارهای مبتنی بر Python.',
    group: 'tools', aliases: ['Python'],
  },
  // Kept for existing URLs and source metadata. Reading format belongs in
  // categories, so this redundant tag is omitted from prominent topic lists.
  'paper-explainer': {
    name: 'خواندن مقالهٔ پژوهشی',
    description: 'نوشته‌هایی برای دنبال‌کردن ایده و روش مقاله‌های پژوهشی.',
    group: 'models', aliases: ['شرح مقاله', 'مقاله', 'paper explainer'], legacy: true,
  },
}

export const topicNames = Object.fromEntries(Object.entries(topics).map(([id, topic]) => [id, topic.name]))

export const topicGroups = [
  { id: 'models', name: 'مدل‌ها و مفهوم‌ها' },
  { id: 'making', name: 'تصویر و حرکت' },
  { id: 'tools', name: 'ابزار و اجرا' },
]

// Additional subject labels are grounded in the existing articles. Their body,
// title, publication date and original tag IDs remain unchanged.
export const articleTopicAdditions = {
  'dreambooth-character-continuity': ['character-continuity'],
  'rife-frame-interpolation': ['frame-interpolation'],
  'cfg-diffusion-guidance': ['image-control'],
  'controlnet-depth': ['image-control'],
}

export const noteKinds = {
  article: 'مقاله',
  concept: 'یادداشت مفهومی',
  method: 'یادداشت پژوهشی',
  'learning-path': 'مسیر مطالعه',
  guide: 'راهنمای شروع',
}

export const noteTaxonomy = {
  home: { kind: 'guide', categoryId: 'fundamentals', topics: ['ai-basics', 'ai-image-making'] },
  diffusion: { kind: 'learning-path', categoryId: 'fundamentals', topics: ['diffusion', 'ai-image-making'] },
  noise: { kind: 'concept', categoryId: 'fundamentals', topics: ['ai-basics', 'diffusion'] },
  seed: { kind: 'concept', categoryId: 'fundamentals', topics: ['ai-image-making'] },
  'latent-diffusion': { kind: 'concept', categoryId: 'fundamentals', topics: ['diffusion'] },
  ddpm: { kind: 'method', categoryId: 'papers', topics: ['diffusion', 'ddpm'] },
}

export const blogCopy = {
  index: {
    title: 'هوش مصنوعی، از مفهوم تا ساخت',
    description: 'خوانش پژوهش‌ها، بررسی ابزارها و یادداشت‌های کوتاه دربارهٔ تصویر، حرکت و ساختن با هوش مصنوعی.',
    featured: 'تازه‌ترین مقاله',
    all: 'همهٔ نوشته‌ها',
    browse: 'نوشتهٔ بعدی را پیدا کن',
  },
  categories: {
    title: 'بخش‌های وبلاگ',
    description: 'یک پژوهش را باز کن، سازوکار یک ابزار را بشناس یا از یک مفهوم شروع کن.',
    label: 'بخش',
    all: 'همهٔ بخش‌ها',
  },
  topics: {
    title: 'موضوع‌ها',
    description: 'از تصویر و حرکت تا مدل‌ها و کد؛ نوشته‌های مرتبط با موضوعت را کنار هم بخوان.',
    label: 'موضوع',
    all: 'همهٔ موضوع‌ها',
  },
  notes: {
    title: 'یادداشت‌ها و مسیرهای مطالعه',
    description: 'یک مفهوم را روشن کن یا قدم‌به‌قدم سراغ نوشته‌های مرتبط برو.',
  },
  filters: {
    searchLabel: 'جست‌وجو در فهرست نوشته‌ها',
    searchPlaceholder: 'عنوان، موضوع یا یک عبارت…',
    kindLabel: 'نوع نوشته',
    allKinds: 'همهٔ نوشته‌ها',
    articles: 'مقاله‌ها',
    notes: 'یادداشت‌ها',
    sortLabel: 'ترتیب نمایش',
    newest: 'تازه‌ترین',
    oldest: 'قدیمی‌ترین',
    shortest: 'مطالعهٔ کوتاه‌تر',
    reset: 'پاک‌کردن فیلترها',
    emptyTitle: 'نوشته‌ای با این انتخاب‌ها پیدا نشد',
    emptyDescription: 'یک فیلتر را بردار یا عبارت کوتاه‌تری جست‌وجو کن.',
    pending: 'در حال آماده‌کردن فهرست…',
  },
  sources: 'منابع و مطالعهٔ بیشتر',
  related: 'برای ادامهٔ این موضوع',
  reading: 'تنظیمات خواندن',
  graph: 'نقشهٔ ارتباط‌ها',
}

export function normalizeBlogQuery(value) {
  return String(value ?? '').normalize('NFKC').toLowerCase()
    .replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/[إأٱآ]/g, 'ا')
    .replace(/[\u064b-\u065f\u0670\u0640]/g, '')
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660))
    .replace(/(?:\u200c|\u200d|_|-)+/g, ' ').replace(/\s+/g, ' ').trim()
}

export function getTopicId(value) {
  if (Object.hasOwn(topics, value)) return value
  const query = normalizeBlogQuery(value)
  return Object.entries(topics).find(([id, topic]) => [id, topic.name, ...topic.aliases].some(label => normalizeBlogQuery(label) === query))?.[0] || null
}

export function getTopicLabel(value) {
  const id = getTopicId(value)
  return id ? topics[id].name : String(value ?? '').replace(/^#/, '').replaceAll('-', ' ')
}

export function entryTopics(entry, { includeLegacy = false } = {}) {
  const ids = [...new Set([...(entry.tags || []), ...(articleTopicAdditions[entry.slug] || [])])]
  const unknown = ids.filter(id => !Object.hasOwn(topics, id))
  if (unknown.length) throw new Error('Unknown topic IDs in ' + (entry.slug || 'article') + ': ' + unknown.join(', '))
  return ids.filter(id => includeLegacy || !topics[id].legacy)
}
