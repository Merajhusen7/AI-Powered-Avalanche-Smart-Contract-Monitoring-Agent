require('dotenv').config();
const { Telegraf } = require('telegraf');
const { shortenAddress, formatAvax } = require('./utils');

// Initialize the Telegram bot with token from .env
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

/**
 * Sends a transaction alert to the specified Telegram chat
 * @param {object} transaction - Transaction data
 * @param {object} receipt - Transaction receipt data
 * @param {Array<string>} reasons - Reasons why this transaction is significant
 */
async function sendTransactionAlert(transaction, receipt, reasons) {
  try {
    // Skip if Telegram configuration is not provided
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
      console.log('Telegram not configured. Skipping alert.');
      return;
    }
    
    const valueInAvax = formatAvax(transaction.value);
    const status = receipt && receipt.status === '0x1' ? '✅ Success' : '❌ Failed';
    const timestamp = new Date().toISOString();
    
    // Format message
    let message = `🚨 *Significant Transaction Detected*\n\n`;
    message += `*Hash:* \`${transaction.hash}\`\n`;
    message += `*Status:* ${status}\n`;
    message += `*From:* \`${shortenAddress(transaction.from)}\`\n`;
    message += `*To:* \`${shortenAddress(transaction.to)}\`\n`;
    message += `*Value:* ${valueInAvax} AVAX\n`;
    
    if (receipt) {
      message += `*Gas Used:* ${parseInt(receipt.gasUsed, 16)}\n`;
    }
    
    message += `\n*Reasons Flagged:*\n`;
    reasons.forEach(reason => {
      message += `- ${reason}\n`;
    });
    
    message += `\n*Time:* ${timestamp}`;
    message += `\n\n[View on AvalancheExplorer](https://snowtrace.io/tx/${transaction.hash})`;
    
    // Send message
    await bot.telegram.sendMessage(
      process.env.TELEGRAM_CHAT_ID,
      message,
      { parse_mode: 'Markdown', disable_web_page_preview: true }
    );
    
    console.log(`Telegram alert sent for transaction ${transaction.hash}`);
  } catch (error) {
    console.error('Error sending Telegram alert:', error.message);
  }
}

/**
 * Sends a system status message to Telegram
 * @param {string} message - Status message
 */
async function sendStatusMessage(message) {
  try {
    // Skip if Telegram configuration is not provided
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
      console.log('Telegram not configured. Skipping status message.');
      return;
    }
    
    await bot.telegram.sendMessage(
      process.env.TELEGRAM_CHAT_ID,
      `📊 *System Status*\n\n${message}`,
      { parse_mode: 'Markdown' }
    );
    
    console.log('Status message sent to Telegram');
  } catch (error) {
    console.error('Error sending status message:', error.message);
  }
}

/**
 * Initializes the Telegram bot and sends a startup message
 */
async function initializeBot() {
  try {
    if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
      console.log('Telegram not configured. Bot initialization skipped.');
      return;
    }
    
    try {
      // Start the bot
      await bot.launch();
      
      // Send startup message
      await sendStatusMessage('🟢 Avalanche AI Monitoring Agent started successfully!');
      
      console.log('Telegram bot initialized');
      
      // Enable graceful stop
      process.once('SIGINT', () => bot.stop('SIGINT'));
      process.once('SIGTERM', () => bot.stop('SIGTERM'));
    } catch (error) {
      console.error('Telegram bot error:', error.message);
      console.log('Continuing monitoring without Telegram notifications...');
    }
  } catch (error) {
    console.error('Failed to initialize Telegram bot:', error.message);
    console.log('Continuing monitoring without Telegram notifications...');
  }
}

module.exports = {
  sendTransactionAlert,
  sendStatusMessage,
  initializeBot
}; 