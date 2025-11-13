// netlify/functions/webhook.ts (ТОЛЬКО ДЛЯ NETLIFY/SERVERLESS)

// --- КОНСТАНТЫ (Чтение из переменных окружения Netlify) ---
const BOT_TOKEN = process.env.BOT_TOKEN || '8232714512:AAFegQAxLFgr6c-DbnaxyjbwOeCpoutF8h0'; 
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID || '476032497';
// --------------------------------------------------------

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

// --- ТИПЫ ДАННЫХ ДЛЯ СЕССИИ ---
interface Session {
    step: number;
    data: {
        name?: string;
        idea?: string;
        email?: string;
    }
}
// Хранение состояния пользователей в памяти (актуально только для короткой жизни Serverless-функций)
const sessions: { [key: number]: Session } = {}; 

/**
 * Отправляет сообщение пользователю через Telegram API.
 */
async function sendMessage(chatId: number, text: string, options: any = {}) {
    const url = `${TELEGRAM_API}/sendMessage`;
    const payload = {
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
        ...options
    };
    
    try {
        // Используем стандартный fetch для HTTP-запросов в Serverless
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.error('Error sending message:', error);
    }
}

/**
 * Форматирует и отправляет уведомление администратору.
 */
async function sendAdminNotification(data: Session['data']) {
    const notificationMessage = 
        `*🚨 НОВАЯ ЗАЯВКА PRIME STUDIO DEV 🚨*\n` +
        `----------------------------------------\n` +
        `👤 *Имя/Ник:* ${data.name || 'Не указано'}\n` +
        `📧 *Контакты:* ${data.email || 'Не указано'}\n` + 
        `💡 *Идея проекта:*\n${data.idea || 'Не указано'}\n` +
        `----------------------------------------\n` +
        `_Свяжитесь с клиентом в течение 24 часов._`;
            
    await sendMessage(parseInt(ADMIN_CHAT_ID), notificationMessage); 
}


/**
 * Основная логика пошаговой обработки входящего сообщения.
 */
async function handleUpdate(update: any) {
    if (!update.message) return;

    const chatId = update.message.chat.id;
    const text = update.message.text ? update.message.text.trim() : '';
    const userId = update.message.from.id;

    // Инициализация или получение текущей сессии
    if (!sessions[userId]) {
        sessions[userId] = { step: 0, data: {} };
    }

    let session = sessions[userId];
    let responseText = '';

    // --- Сброс и начало сессии ---
    if (text === '/start') {
        session.step = 1;
        session.data = {};
        responseText = 
            `*Привет!* На связи помощник команды Prime Studio Dev. ` + 
            `Я помогу быстро собрать всю необходимую информацию по Вашему проекту. Давайте начнем.\n\n` + 
            `*Шаг 1 из 3:* Для начала, как я могу к Вам обращаться? Пожалуйста, введите Ваше имя.`;
        await sendMessage(chatId, responseText);
        return;
    }
    
    if (session.step === 0) {
        responseText = "Для начала работы, пожалуйста, введите команду /start";
        await sendMessage(chatId, responseText);
        return;
    }

    // --- Логика пошагового сбора данных ---

    switch (session.step) {
        case 1: // Ожидание Имени
            session.data.name = text;
            session.step = 2;
            responseText = 
                `*Шаг 2 из 3:* Отлично, ${session.data.name}, спасибо! Теперь перейдем к проекту. Опишите Вашу основную идею. ` +
                `Пожалуйста, включите следующие детали:\n` +
                `1. Название проекта\n` +
                `2. Ключевые функции\n` +
                `3. Какая цель у Вашего проекта`;
            break;

        case 2: // Ожидание Идеи
            session.data.idea = text;
            session.step = 3;
            responseText = 
                `*Шаг 3 из 3 (последний):* Понял! И финальный штрих: ` +
                `пожалуйста, укажите Ваши контактные данные в удобном для Вас формате ` +
                `(*Email*, *Telegram*, *WhatsApp*). Мы используем их для официального ответа на Ваш запрос.`;
            break;

        case 3: // Ожидание Контактов и завершение
            session.data.email = text; 
            session.step = 4; // Завершение сессии
            
            // 1. Отправляем уведомление вам (ADMIN_CHAT_ID)
            await sendAdminNotification(session.data);
            
            // 2. Отправляем сообщение пользователю
            responseText = 
                `*✅ Готово!* Ваша заявка успешно принята. Команда Prime Studio Dev ознакомится с деталями и ` + 
                `свяжется с Вами лично в течение *24 часов*. Спасибо за интерес к совместной работе!`;
            
            // Удаляем сессию
            delete sessions[userId];
            break;

        default:
            responseText = "Сессия завершена. Начните новую командой /start";
            break;
    }

    if (session.step !== 4 && session.step !== 0) {
        await sendMessage(chatId, responseText);
    }
}


// ====================================================================
// --- КОРРЕКТНЫЙ ЭКСПОРТ ОБРАБОТЧИКА ДЛЯ NETLIFY ---
// ====================================================================

/**
 * ЭКСПОРТ: Netlify Functions требует экспорта функции 'handler'.
 */
exports.handler = async (event: any, context: any) => {
    // Проверяем, что это POST-запрос с телом (т.е. Webhook от Telegram)
    if (event.httpMethod === 'POST' && event.body) {
        
        let body;
        try {
            // Тело Webhook приходит как строка и его нужно разобрать (парсинг JSON)
            body = JSON.parse(event.body);
        } catch (e) {
            // Возвращаем 400, если тело не является валидным JSON
            return { statusCode: 400, body: 'Invalid JSON' };
        }

        // Вызываем основную логику бота
        await handleUpdate(body);
        
        // ВСЕГДА возвращаем 200 OK, чтобы Telegram не переотправлял запрос
        return { statusCode: 200, body: 'OK' }; 
        
    } else {
        // Ответ на GET-запросы для проверки, что функция активна
        return { statusCode: 200, body: 'Bot is running and ready for webhooks.' };
    }
};