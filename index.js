require('dotenv').config();
const express = require('express');
const { MessagingResponse } = require('twilio').twiml;
const Anthropic = require('@anthropic-ai/sdk');
const mongoose = require('mongoose');
const { handleIncoming } = require('./handlers/messageHandler');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Connect MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB error:', err));

// Health check
app.get('/', (req, res) => res.send('Dhanwanti is alive 🙏'));

// WhatsApp webhook
app.post('/webhook', async (req, res) => {
  const twiml = new MessagingResponse();

  try {
    const from = req.body.From;        // whatsapp:+91xxxxxxxxxx
    const body = req.body.Body || '';
    const mediaUrl = req.body.MediaUrl0 || null;
    const mediaType = req.body.MediaContentType0 || null;

    console.log(`Message from ${from}: ${body}`);

    const reply = await handleIncoming({ from, body, mediaUrl, mediaType });

    twiml.message(reply);
  } catch (err) {
    console.error('Webhook error:', err);
    twiml.message('Didi, abhi thodi takleef aa rahi hai. Thodi der mein phir try karein 🙏');
  }

  res.type('text/xml');
  res.send(twiml.toString());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Saathi running on port ${PORT}`));