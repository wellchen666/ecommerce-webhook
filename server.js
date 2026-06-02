const express = require('express');
const axios = require('axios');
const fs = require('fs');

const app = express();
app.use(express.json());

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'ecommerce_webhook_2026';
const PAGE_TOKEN = process.env.FACEBOOK_PAGE_TOKEN;
const IG_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN;

const REPLY_MESSAGE = "謝謝你的訊息！想了解更多電商實戰技巧，加 LINE @818tnyhu，會有專人為你服務 🙌";

const repliedUsers = new Set();
const REPLIED_FILE = '/tmp/replied_users.json';

try {
  if (fs.existsSync(REPLIED_FILE)) {
    const data = JSON.parse(fs.readFileSync(REPLIED_FILE, 'utf8'));
    data.forEach(id => repliedUsers.add(id));
  }
} catch (e) {}

function saveReplied() {
  try { fs.writeFileSync(REPLIED_FILE, JSON.stringify([...repliedUsers])); } catch (e) {}
}

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook 驗證成功');
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  const body = req.body;
  console.log('收到 webhook：', JSON.stringify(body).substring(0, 200));
  
  if (body.object === 'page' || body.object === 'instagram') {
    for (const entry of body.entry) {
      const messaging = entry.messaging || [];
      for (const event of messaging) {
        const senderId = event.sender.id;
        
        if (event.message && event.message.is_echo) continue;
        if (!event.message) continue;
        
        if (repliedUsers.has(senderId)) {
          console.log('已回覆過：', senderId);
          continue;
        }
        
        const token = body.object === 'instagram' ? IG_TOKEN : PAGE_TOKEN;
        const apiUrl = body.object === 'instagram' 
          ? 'https://graph.instagram.com/v21.0/me/messages'
          : 'https://graph.facebook.com/v21.0/me/messages';
        
        try {
          await axios.post(apiUrl, {
            recipient: { id: senderId },
            message: { text: REPLY_MESSAGE }
          }, {
            params: { access_token: token }
          });
          
          repliedUsers.add(senderId);
          saveReplied();
          console.log('✅ 已回覆：', senderId);
        } catch (err) {
          console.error('❌ 回覆失敗：', err.response?.data || err.message);
        }
      }
    }
  }
  
  res.status(200).send('EVENT_RECEIVED');
});

app.get('/', (req, res) => res.send('Webhook 運作中 ✅'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Webhook 啟動於 port ' + PORT));
