/**
 * Frequency filter for the vocab tooltip. We only want to offer translations for
 * genuinely advanced words — students already know basic/intermediate vocabulary,
 * so underlining every word is noise (and wastes Groq calls).
 *
 * A word is a lookup target only if it is NOT in this common-word set (after light
 * stemming) and is reasonably long. The set holds the ~1000 most frequent English
 * base words; combined with the length floor and suffix-stripping, that suppresses
 * the everyday vocabulary and leaves the handful of hard words per passage.
 *
 * Shared by the client (PassageReader, to decide what to underline) and the server
 * (the /api/vocab guard), so the two never disagree. No 'server-only' here.
 */

/** Lowercase a token and strip surrounding punctuation to its bare word form. */
export function normalizeWord(raw: string): string {
  return raw.toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, '').trim();
}

// The 1000-ish most common English words (mixed lengths so inflections stem-match).
const COMMON_WORDS = new Set<string>([
  // function words & pronouns
  'the','a','an','and','or','but','if','then','than','so','because','as','while','until','although','though','unless','whether','since','before','after','once','when','where','why','how','what','which','who','whom','whose','that','this','these','those','here','there',
  'i','you','he','she','it','we','they','me','him','her','us','them','my','your','his','its','our','their','mine','yours','hers','ours','theirs','myself','yourself','himself','herself','itself','ourselves','themselves',
  'is','am','are','was','were','be','been','being','do','does','did','done','have','has','had','having','will','would','shall','should','can','could','may','might','must','ought',
  'of','to','in','on','at','by','for','with','about','against','between','into','through','during','without','within','along','across','behind','beyond','under','over','above','below','from','up','down','out','off','near','upon','onto','toward','towards','per','via',
  'not','no','nor','yes','too','very','just','only','also','even','still','again','ever','never','always','often','sometimes','usually','rarely','almost','already','soon','now','today','tomorrow','yesterday','later','early','late','ago','back','away','here','there','everywhere','anywhere','somewhere','nowhere',
  'all','any','both','each','every','few','more','most','some','such','many','much','several','enough','little','less','least','other','others','another','same','own','whole','half','none','one','two','three','four','five','six','seven','eight','nine','ten','first','second','third','last','next','few','lot','lots',
  'and','about','above','after','again','against','because','before','being','below','between','both','during','each','further','here','itself','more','most','other','over','same','some','such','than','that','then','there','these','they','this','those','through','under','until','very','what','when','where','which','while','will','with','would',

  // extremely common verbs / nouns / adjectives
  'go','goes','went','gone','going','get','gets','got','gotten','getting','make','makes','made','making','take','takes','took','taken','taking','come','comes','came','coming','see','sees','saw','seen','seeing','know','knows','knew','known','knowing','think','thinks','thought','thinking','say','says','said','saying','tell','tells','told','telling','give','gives','gave','given','giving','find','finds','found','finding','want','wants','wanted','use','uses','used','using','work','works','worked','working','call','calls','called','calling','try','tries','tried','trying','ask','asks','asked','asking','need','needs','needed','feel','feels','felt','feeling','become','becomes','became','leave','leaves','left','leaving','put','puts','putting','mean','means','meant','keep','keeps','kept','keeping','let','lets','begin','begins','began','begun','seem','seems','seemed','help','helps','helped','helping','talk','talks','talked','turn','turns','turned','start','starts','started','show','shows','showed','shown','hear','hears','heard','play','plays','played','run','runs','ran','running','move','moves','moved','like','likes','liked','live','lives','lived','living','believe','believes','believed','bring','brings','brought','happen','happens','happened','write','writes','wrote','written','writing','provide','provides','provided','sit','sits','sat','stand','stands','stood','lose','loses','lost','pay','pays','paid','meet','meets','met','include','includes','included','continue','continues','continued','set','sets','learn','learns','learned','change','changes','changed','lead','leads','led','understand','understands','understood','watch','watches','watched','follow','follows','followed','stop','stops','stopped','create','creates','created','speak','speaks','spoke','spoken','read','reads','reading','spend','spends','spent','grow','grows','grew','grown','open','opens','opened','walk','walks','walked','win','wins','won','offer','offers','offered','remember','remembers','remembered','love','loves','loved','consider','considers','considered','appear','appears','appeared','buy','buys','bought','wait','waits','waited','serve','serves','served','die','dies','died','send','sends','sent','build','builds','built','stay','stays','stayed','fall','falls','fell','fallen','reach','reaches','reached','kill','kills','killed','remain','remains','remained',

  // common nouns
  'time','year','years','people','person','way','ways','day','days','man','men','woman','women','child','children','kid','kids','life','lives','world','school','schools','state','states','family','families','student','students','group','groups','country','countries','problem','problems','hand','hands','part','parts','place','places','case','cases','week','weeks','company','companies','system','systems','program','programs','question','questions','answer','answers','work','works','government','number','numbers','night','nights','point','points','home','homes','water','room','rooms','mother','father','area','areas','money','story','stories','fact','facts','month','months','lot','right','study','studies','book','books','eye','eyes','job','jobs','word','words','business','issue','issues','side','sides','kind','kinds','head','heads','house','houses','service','services','friend','friends','hour','hours','game','games','line','lines','end','ends','member','members','law','laws','car','cars','city','cities','community','name','names','team','teams','minute','minutes','idea','ideas','body','bodies','information','back','parent','parents','face','faces','level','levels','office','offices','door','doors','health','art','arts','war','wars','history','party','result','results','change','changes','reason','reasons','research','girl','girls','guy','guys','moment','moments','air','teacher','teachers','force','forces','education','foot','feet','boy','boys','age','ages','policy','policies','process','music','market','markets','sense','nation','nations','plan','plans','college','interest','death','experience','effect','effects','class','classes','control','field','fields','role','roles','effort','rate','rates','heart','hearts','drug','drugs','show','shows','leader','leaders','light','voice','wife','wives','police','mind','minds','price','prices','report','reports','decision','son','sons','view','views','value','values','base','door','table','tables','color','colors','space','energy','animal','animals','tree','trees','food','plant','plants',

  // common adjectives / adverbs
  'good','better','best','bad','worse','worst','great','greater','high','higher','highest','low','lower','small','smaller','large','larger','big','bigger','long','longer','short','shorter','little','old','older','young','younger','new','newer','important','public','able','human','local','sure','early','young','few','strong','stronger','possible','whole','free','true','full','special','clear','clearer','recent','certain','personal','open','red','difficult','available','likely','short','single','medical','current','wrong','private','past','foreign','fine','common','poor','natural','significant','similar','hot','dead','central','happy','serious','ready','simple','left','physical','general','environmental','financial','blue','democratic','dark','various','entire','close','legal','religious','cold','final','main','green','nice','huge','popular','traditional','cultural','easy','easier','hard','harder','heavy','beautiful','quick','quickly','slow','slowly','really','actually','probably','perhaps','maybe','especially','clearly','simply','nearly','quite','rather','pretty','enough','far','farther','deep','wide','warm','safe','rich','quiet','fast','bright','fair','clean','fresh','wild','calm','sharp','smooth','tight','loose','plain','busy','tiny','brief','equal','exact','direct','aware','alone','alive','asleep','awake',
]);

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);

/** Candidate base forms for an inflected word (light, rule-based stemming). */
function candidateStems(word: string): string[] {
  const out = [word];
  const add = (s: string) => {
    if (s.length >= 2) out.push(s);
  };

  if (word.endsWith('ies') && word.length > 4) add(word.slice(0, -3) + 'y');
  if (word.endsWith('es')) add(word.slice(0, -2));
  if (word.endsWith('s') && !word.endsWith('ss')) add(word.slice(0, -1));
  if (word.endsWith('ed')) {
    add(word.slice(0, -2)); // walked → walk
    add(word.slice(0, -1)); // liked → like
  }
  if (word.endsWith('ing')) {
    const root = word.slice(0, -3);
    add(root); // running → runn (won't match) / reading → read
    add(root + 'e'); // making → make
    // de-double a final doubled consonant: running → run
    if (root.length >= 2 && root[root.length - 1] === root[root.length - 2] && !VOWELS.has(root[root.length - 1])) {
      add(root.slice(0, -1));
    }
  }
  if (word.endsWith('ly')) add(word.slice(0, -2));
  if (word.endsWith('er')) add(word.slice(0, -2));
  if (word.endsWith('est')) add(word.slice(0, -3));

  return out;
}

/**
 * A word is "advanced" (worth a translation) when it is long enough and neither it
 * nor any of its likely base forms is in the common-word set.
 */
export function isAdvancedWord(raw: string): boolean {
  const w = normalizeWord(raw);
  if (w.length < 5) return false;
  if (!/^[a-z][a-z'-]*$/.test(w)) return false;
  for (const cand of candidateStems(w)) {
    if (COMMON_WORDS.has(cand)) return false;
  }
  return true;
}
