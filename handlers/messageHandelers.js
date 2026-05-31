const Anthropic = require('@anthropic-ai/sdk');
const Session = require('../models/Session');
const { getDhanwantiPrompt } = require('../prompts/dhanwanti');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Language onboarding message
const ONBOARDING_MESSAGE = `Namaste 🙏 / नमस्ते / নমস্কার

Main Dhanwanti hoon — Saathi ki taraf se aapki apni didi aur nurse.
मैं धन्वन्ती हूँ — साथी की तरफ से आपकी अपनी दीदी और नर्स।
আমি ধন্বন্তী — সাথীর তরফ থেকে আপনার নিজের দিদি আর নার্স।

Apni bhasha chunein / अपनी भाषा चुनें / আপনার ভাষা বেছে নিন:

1️⃣ हिंदी (Hindi)
2️⃣ বাংলা (Bengali)
3️⃣ मैथिली (Maithili)
4️⃣ अंगिका (Angika)

Sirf number bhejein / শুধু নম্বর পাঠান / बस नंबर भेजें 👇`;

const LANGUAGE_MAP = {
  '1': 'hindi',
  '2': 'bengali',
  '3': 'maithili',
  '4': 'angika'
};

const WELCOME_MESSAGES = {
  hindi: 'Namaste didi 🙏 Main Dhanwanti hoon — aapki apni didi aur nurse. Aaj aap kaisi hain? Koi takleef hai ya bas baat karni thi? Main yahan hoon — bilkul befikar hokar batayein.',
  bengali: 'নমস্কার দিদি 🙏 আমি ধন্বন্তী — আপনার নিজের দিদি আর নার্স। আজ আপনি কেমন আছেন? কোনো কষ্ট আছে, নাকি শুধু একটু কথা বলতে চাইছিলেন? আমি এখানে আছি — নিশ্চিন্তে বলুন।',
  maithili: 'प्रणाम दीदी 🙏 हम धन्वन्ती छी — अहाँक अपन दीदी आ नर्स। आइ अहाँ केना छी? कोनो तकलीफ अछि की बस बात करबाक छल? हम एतय छी — निश्चिंत भ\' क\' बताउ।',
  angika: 'प्रणाम दीदी 🙏 हमी धन्वन्ती छियै — तोहर अपन दीदी आ नर्स। आज तोंय केना छें? कोय तकलीफ छौ की बस बात करैक छलौ? हमी एत्ते छियै — बेझिझक बतावा।'
};

async function handleIncoming({ from, body, mediaUrl, mediaType }) {
  // Get or create session
  let session = await Session.findOne({ userId: from });

  if (!session) {
    session = new Session({ userId: from });
    await session.save();
  }

  // Update last active
  session.lastActive = new Date();

  // STEP 1 — Language onboarding
  if (!session.onboarded) {
    const choice = body.trim();

    if (LANGUAGE_MAP[choice]) {
      // User selected language
      session.language = LANGUAGE_MAP[choice];
      session.onboarded = true;
      await session.save();
      return WELCOME_MESSAGES[session.language];
    } else {
      // Send onboarding message
      await session.save();
      return ONBOARDING_MESSAGE;
    }
  }

  // STEP 2 — Active conversation — route to Dhanwanti
  let userMessage = body;

  // Handle image (medicine photo)
  if (mediaType && mediaType.startsWith('image/')) {
    userMessage = `[User sent a medicine/health photo: ${mediaUrl}] Please acknowledge you can see it and ask what they need help with regarding this medicine or health image.`;
  }

  // Handle voice note
  if (mediaType && mediaType.startsWith('audio/')) {
    userMessage = `[User sent a voice note — transcription not available yet] Please ask them to type their message for now.`;
  }

  // Add to history
  session.history.push({ role: 'user', content: userMessage });

  // Keep last 10 messages only — token control
  if (session.history.length > 10) {
    session.history = session.history.slice(-10);
  }

  // Call Claude API
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    system: getDhanwantiPrompt(session.language),
    messages: session.history.map(h => ({ role: h.role, content: h.content }))
  });

  const reply = response.content[0].text;

  // Save assistant reply to history
  session.history.push({ role: 'assistant', content: reply });
  await session.save();

  return reply;
}

module.exports = { handleIncoming };