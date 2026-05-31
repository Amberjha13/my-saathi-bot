const Anthropic = require('@anthropic-ai/sdk');
const Session = require('../models/Session');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const LANGUAGE_OPTIONS = {
  '1': 'hindi',
  '2': 'bengali',
  '3': 'maithili',
  '4': 'angika',
};

const LANGUAGE_PROMPT = `Namaste! Main Dhanwanti hoon, aapki swasthya sahayika 🙏

Apni bhasha chunein / Choose your language:
1️⃣ Hindi
2️⃣ Bengali
3️⃣ Maithili
4️⃣ Angika

Bas number bhejein (1-4)`;

const SYSTEM_PROMPTS = {
  hindi: `Aap Dhanwanti hain — ek saheliyon jaisi, bharosemand swasthya sahayika jo gramin mahilaon ki madad karti hain. Aap sirf Hindi mein baat karein. Simple, warm aur clear bhasha use karein. Mahilaon ko matritva swasthya, poshan, aur samanya bimariyon ke baare mein sahi jaankari dein. Agar koi gambhir bimari lage toh doctor se milne ki salah zaroor dein.`,
  bengali: `Apni Dhanwanti — ekjon bondhur moto bishasghogyo swasthya sahayika jo gramin mahilader saahajjo koren. Sudhu Bangla bhashay kotha bolun. Saroj, usnota ebong sposta bhasha byabohar korun. Mahilader matritva swasthya, pusti ebong sadharon rogbalai somporke sठhik tothyo din. Jodi gambhir kono rog mone hoy, obossoi doctor dekhanor poromorsh din.`,
  maithili: `Ahaan Dhanwanti chhī — ek saheli jaisan, bharosanemand swasthya sahayika je gramin mahilaganke madad karainch hain. Sirf Maithili mein baat karein. Saral, snehil aur spasht bhasha upayog karein. Mahilaganke matritva swasthya, poshan aur samanya bimariyan ke baare mein sahi jaankari dein. Jadi koi gambhir bimari lage toh doctor se milbaak salah jaroor dein.`,
  angika: `Toh Dhanwanti cha — ek sakhiyan jaisan, bharosanemand swasthya sahayika jo gramin mahilaganke madad kara cha. Sirf Angika mein baat karo. Saral, snehil aur spasht bhasha upayog karo. Mahilaganke matritva swasthya, poshan aur samanya bimariyan ke baare mein sahi jaankari dao. Jadi koi gambhir bimari lage toh doctor se milbaak salah zaroor dao.`,
};

async function handleIncoming({ from, body, mediaUrl, mediaType }) {
  const userId = from;
  const text = body.trim();

  let session = await Session.findOne({ userId });
  if (!session) {
    session = await Session.create({ userId });
  }

  // Update lastActive
  session.lastActive = new Date();

  // Onboarding: language selection
  if (!session.onboarded) {
    const choice = LANGUAGE_OPTIONS[text];
    if (!choice) {
      await session.save();
      return LANGUAGE_PROMPT;
    }
    session.language = choice;
    session.onboarded = true;
    await session.save();
    return `Bahut shukriya! Ab main aapse ${choice} mein baat karungi 🙏\n\nAaj aap kaise hain? Koi swasthya se judi baat karni ho toh batayein.`;
  }

  // Build message content (text + optional image)
  const userContent = [];
  if (mediaUrl && mediaType && mediaType.startsWith('image/')) {
    userContent.push({ type: 'image', source: { type: 'url', url: mediaUrl } });
  }
  if (text) {
    userContent.push({ type: 'text', text });
  }
  if (userContent.length === 0) {
    return 'Kripya kuch likhein ya image bhejein 🙏';
  }

  // Append user message to history
  session.history.push({ role: 'user', content: text || '[image]' });

  // Keep history to last 20 messages to avoid token bloat
  if (session.history.length > 20) {
    session.history = session.history.slice(-20);
  }

  // Build messages array for Claude
  const messages = session.history.slice(0, -1).map(m => ({
    role: m.role,
    content: m.content,
  }));
  messages.push({ role: 'user', content: userContent });

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: SYSTEM_PROMPTS[session.language] || SYSTEM_PROMPTS.hindi,
    messages,
  });

  const reply = response.content[0].text;

  session.history.push({ role: 'assistant', content: reply });
  await session.save();

  return reply;
}

module.exports = { handleIncoming };
