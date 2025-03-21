require('dotenv').config();
const OpenAI = require('openai');
const { formatAvax, shortenAddress } = require('./utils');

// Initialize OpenAI client if API key is available
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

/**
 * Analyzes a transaction using OpenAI to detect potential anomalies or suspicious activity
 * @param {object} transaction - The transaction object
 * @param {object} receipt - The transaction receipt
 * @returns {Promise<object>} - Analysis result {isAnomaly, confidence, explanation}
 */
async function analyzeTransactionWithAI(transaction, receipt) {
  try {
    // If OpenAI is not configured, return a default response
    if (!openai) {
      console.log('OpenAI not configured. Skipping AI analysis.');
      return {
        isAnomaly: false,
        confidence: 0,
        explanation: 'AI analysis not available',
        aiEnabled: false
      };
    }
    
    // Format transaction data for AI analysis
    const valueInAvax = formatAvax(transaction.value);
    const from = shortenAddress(transaction.from);
    const to = shortenAddress(transaction.to);
    const gasUsed = receipt ? parseInt(receipt.gasUsed, 16) : 'Unknown';
    const gasPrice = formatAvax(transaction.gasPrice, 9);
    const status = receipt && receipt.status === '0x1' ? 'Success' : 'Failed';
    
    // Create an AI-friendly description of the transaction
    const transactionDescription = `
      Transaction Hash: ${transaction.hash}
      From: ${from}
      To: ${to}
      Value: ${valueInAvax} AVAX
      Gas Used: ${gasUsed}
      Gas Price: ${gasPrice} AVAX
      Status: ${status}
      Block Number: ${parseInt(transaction.blockNumber, 16)}
      Transaction Index: ${parseInt(transaction.transactionIndex, 16)}
    `;
    
    // Prompt for OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // or another appropriate model
      messages: [
        {
          role: "system",
          content: "You are a blockchain security expert specializing in detecting anomalous or suspicious transactions on the Avalanche C-Chain. You will analyze transaction details and determine if there are any red flags or unusual patterns. Respond with a clear assessment, a confidence score from 0 to 100, and an explanation."
        },
        {
          role: "user",
          content: `Analyze this Avalanche C-Chain transaction and determine if it shows any signs of being anomalous, suspicious, or potentially fraudulent:\n${transactionDescription}\n\nIs this transaction anomalous or suspicious? Provide a confidence score (0-100) and explanation.`
        }
      ],
      temperature: 0.1, // Lower temperature for more deterministic outputs
      max_tokens: 500
    });
    
    const aiResponse = response.choices[0].message.content;
    console.log('AI Response:', aiResponse);
    
    // Parse the AI response to extract key information
    // This is a simple parsing logic - production use might need more robust parsing
    const isAnomalyMatch = aiResponse.match(/anomalous|suspicious|fraudulent/i);
    const confidenceMatch = aiResponse.match(/confidence[:\s]+(\d+)/i);
    
    const isAnomaly = isAnomalyMatch !== null;
    const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 50;
    
    return {
      isAnomaly,
      confidence,
      explanation: aiResponse,
      aiEnabled: true
    };
  } catch (error) {
    console.error('Error in AI analysis:', error.message);
    return {
      isAnomaly: false,
      confidence: 0,
      explanation: `AI analysis error: ${error.message}`,
      aiEnabled: false
    };
  }
}

module.exports = {
  analyzeTransactionWithAI
}; 