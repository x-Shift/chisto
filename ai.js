const fetch = require("node-fetch")

async function getAIResponse(userMessage, userId, messageHistory, modelId, apiUrl, apiKey) {
  try {
    // Foydalanuvchi tarixini olish
    let userHistory = messageHistory.get(userId) || []
    userHistory = userHistory.slice(-5) // Oxirgi 5 ta xabar

    // Xabarlar massivini tayyorlash
    const messages = [
      {
        role: "system",
        content: "Siz foydali AI yordamchisiz. O'zbek tilida javob bering va foydalanuvchiga yordam ko'rsating.",
      },
      ...userHistory,
      { role: "user", content: userMessage },
    ]

    // AI API ga so'rov yuborish
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000,
      }),
    })

    // Javobni tekshirish
    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(`API xatosi: ${JSON.stringify(errorData)}`)
    }

    const data = await response.json()

    // Javob strukturasini tekshirish
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error("Noto'g'ri API javobi")
    }

    const aiResponse = data.choices[0].message.content

    // Tarixni yangilash
    userHistory.push({ role: "user", content: userMessage })
    userHistory.push({ role: "assistant", content: aiResponse })
    messageHistory.set(userId, userHistory)

    return aiResponse
  } catch (error) {
    console.error("AI xatosi:", error)

    if (error.message.includes("API xatosi")) {
      return "❌ AI xizmatida xatolik. Keyinroq urinib ko'ring."
    }

    return "❌ So'rovni qayta ishlay olmadim. Qayta urinib ko'ring."
  }
}

module.exports = {
  getAIResponse,
}
