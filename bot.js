// ========================================
// SOZLAMALAR - Bu yerga barcha API va tokenlarni kiriting
// ========================================

const TELEGRAM_BOT_TOKEN = "" // @BotFather dan olingan token
const AI_API_KEY = "" // AI API kaliti
const AI_API_URL = "https://api.intelligence.io.solutions/api/v1/chat/completions"
const ADMIN_IDS = ["123456789", "987654321"] // Admin foydalanuvchilar ID'lari

// ========================================
// BOT KODI - Bu qismni o'zgartirmang
// ========================================

const TelegramBot = require("node-telegram-bot-api")
const fs = require("fs")
const { getAIResponse } = require("./ai")

// Bot yaratish
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true })

// Foydalanuvchilar ma'lumotlarini yuklash
let users = {}
try {
  const usersData = fs.readFileSync("users.json", "utf8")
  users = JSON.parse(usersData)
} catch (error) {
  console.log("📝 Yangi users.json fayli yaratildi")
  users = {}
}

// Foydalanuvchilar ma'lumotlarini saqlash
function saveUsers() {
  fs.writeFileSync("users.json", JSON.stringify(users, null, 2))
}

// Sessiyalar va tarix
const userSessions = new Map()
const messageHistory = new Map()

// AI modellari
const MODELS = {
  llama: {
    name: "Meta Llama 3.3 70B",
    id: "meta-llama/Llama-3.3-70B-Instruct",
    description: "Kuchli va tez",
  },
  gpt: {
    name: "GPT-4 Turbo",
    id: "openai/gpt-4-turbo",
    description: "Eng yaxshi sifat",
  },
  claude: {
    name: "Claude 3 Sonnet",
    id: "anthropic/claude-3-sonnet",
    description: "Yaratuvchi",
  },
}

// Foydalanuvchini qo'shish
function addUser(userData) {
  const userId = userData.id.toString()
  if (!users[userId]) {
    users[userId] = {
      id: userData.id,
      name: userData.name,
      username: userData.username,
      joinDate: new Date().toISOString(),
      messageCount: 0,
      lastActive: new Date().toISOString(),
    }
    saveUsers()
  }
}

// Statistikani yangilash
function updateUserStats(userId) {
  const userIdStr = userId.toString()
  if (users[userIdStr]) {
    users[userIdStr].messageCount++
    users[userIdStr].lastActive = new Date().toISOString()
    saveUsers()
  }
}

// /start buyrug'i
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id
  const userId = msg.from.id
  const userName = msg.from.first_name || "Foydalanuvchi"

  addUser({
    id: userId,
    name: userName,
    username: msg.from.username,
  })

  const welcomeMessage = `🤖 Assalomu alaykum, ${userName}!

Men AI chat botman. Sizga yordam berish uchun tayyorman!

🔹 Turli AI modellari bilan suhbat
🔹 Savollaringizga javob berish  
🔹 Matn yaratish va tahlil

Boshlash uchun modelni tanlang: /models`

  bot.sendMessage(chatId, welcomeMessage, {
    reply_markup: {
      keyboard: [["🤖 Modellar", "📊 Statistika"], ["❓ Yordam"]],
      resize_keyboard: true,
    },
  })
})

// Modellarni ko'rsatish
bot.onText(/\/models/, (msg) => {
  const chatId = msg.chat.id
  const modelButtons = Object.keys(MODELS).map((key) => [
    {
      text: `${MODELS[key].name} - ${MODELS[key].description}`,
      callback_data: `model_${key}`,
    },
  ])

  bot.sendMessage(chatId, "🤖 AI modelini tanlang:", {
    reply_markup: {
      inline_keyboard: modelButtons,
    },
  })
})

// Model tanlash
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id
  const userId = query.from.id
  const data = query.data

  if (data.startsWith("model_")) {
    const modelKey = data.replace("model_", "")
    const model = MODELS[modelKey]

    if (model) {
      userSessions.set(userId, { selectedModel: modelKey })
      bot.editMessageText(`✅ ${model.name} tanlandi!\n\nSavolingizni yuboring.`, {
        chat_id: chatId,
        message_id: query.message.message_id,
      })
    }
  }

  bot.answerCallbackQuery(query.id)
})

// Xabarlarni qayta ishlash
bot.on("message", async (msg) => {
  const chatId = msg.chat.id
  const userId = msg.from.id
  const text = msg.text

  if (!text || text.startsWith("/")) return

  // Tugmalar
  if (text === "🤖 Modellar") {
    return bot.sendMessage(chatId, "Modelni tanlash: /models")
  }

  if (text === "📊 Statistika") {
    const user = users[userId.toString()]
    const stats = user
      ? `📊 Statistika:\n\n💬 Xabarlar: ${user.messageCount}\n📅 Qo'shilgan: ${new Date(user.joinDate).toLocaleDateString("uz-UZ")}`
      : "📊 Statistika topilmadi"
    return bot.sendMessage(chatId, stats)
  }

  if (text === "❓ Yordam") {
    return bot.sendMessage(
      chatId,
      `❓ Yordam:

/start - Botni boshlash
/models - Modellarni ko'rish  
/admin - Admin panel (faqat adminlar)
/users - Foydalanuvchilar (faqat adminlar)`,
    )
  }

  // Model tanlanganligini tekshirish
  const session = userSessions.get(userId)
  if (!session || !session.selectedModel) {
    return bot.sendMessage(chatId, "⚠️ Avval modelni tanlang: /models")
  }

  // AI javob olish
  const typingMsg = await bot.sendMessage(chatId, "🤔 O'ylayapman...")

  try {
    const selectedModel = MODELS[session.selectedModel]
    const response = await getAIResponse(text, userId, messageHistory, selectedModel.id, AI_API_URL, AI_API_KEY)

    updateUserStats(userId)

    bot.editMessageText(response, {
      chat_id: chatId,
      message_id: typingMsg.message_id,
    })
  } catch (error) {
    console.error("Xato:", error)
    bot.editMessageText("❌ Xatolik yuz berdi. Qayta urinib ko'ring.", {
      chat_id: chatId,
      message_id: typingMsg.message_id,
    })
  }
})

// Admin buyruqlari
bot.onText(/\/admin/, (msg) => {
  const userId = msg.from.id.toString()
  const chatId = msg.chat.id

  if (!ADMIN_IDS.includes(userId)) {
    return bot.sendMessage(chatId, "❌ Admin huquqi yo'q")
  }

  const totalUsers = Object.keys(users).length
  const activeToday = Object.values(users).filter((user) => {
    const today = new Date().toDateString()
    return new Date(user.lastActive).toDateString() === today
  }).length

  const adminMsg = `⚙️ Admin Panel

👥 Jami foydalanuvchilar: ${totalUsers}
🟢 Bugun faol: ${activeToday}

Buyruqlar:
/users - Foydalanuvchilar ro'yxati`

  bot.sendMessage(chatId, adminMsg)
})

bot.onText(/\/users/, (msg) => {
  const userId = msg.from.id.toString()
  const chatId = msg.chat.id

  if (!ADMIN_IDS.includes(userId)) {
    return bot.sendMessage(chatId, "❌ Admin huquqi yo'q")
  }

  let usersList = "👥 Foydalanuvchilar:\n\n"
  const userArray = Object.values(users)

  userArray.slice(0, 20).forEach((user, index) => {
    usersList += `${index + 1}. ${user.name}\n`
    usersList += `   ID: ${user.id}\n`
    usersList += `   Xabarlar: ${user.messageCount}\n\n`
  })

  if (userArray.length > 20) {
    usersList += `... va yana ${userArray.length - 20} ta foydalanuvchi`
  }

  bot.sendMessage(chatId, usersList)
})

// Bot ishga tushganda
console.log("🤖 Bot ishga tushdi!")
console.log("📝 Sozlamalarni tekshiring:")
console.log(`   Token: ${TELEGRAM_BOT_TOKEN ? "✅" : "❌"}`)
console.log(`   AI API: ${AI_API_KEY ? "✅" : "❌"}`)
console.log(`   Adminlar: ${ADMIN_IDS.length}`)

// Xatolarni boshqarish
bot.on("polling_error", (error) => {
  console.error("❌ Polling xatosi:", error.message)
})

bot.on("error", (error) => {
  console.error("❌ Bot xatosi:", error.message)
})
