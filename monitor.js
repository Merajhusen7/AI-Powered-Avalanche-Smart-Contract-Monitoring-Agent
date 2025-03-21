require('dotenv').config();
const axios = require('axios');
const { ethers } = require('ethers');
const utils = require('./utils');
const telegramBot = require('./telegramBot');
const aiAnalysis = require('./ai_analysis');

// Track the last processed block to avoid duplicate processing
let lastProcessedBlock = null;

/**
 * Process a single transaction, analyze it, and send alerts if significant
 * @param {object} transaction - Transaction object from block
 */
async function processTransaction(transaction) {
  try {
    // Skip transactions with no value (0 AVAX)
    if (transaction.value === '0x0') {
      return;
    }
    
    // Get transaction receipt for additional details
    const receipt = await utils.getTransactionReceipt(transaction.hash);
    
    // Check if transaction is significant based on basic rules
    const { isSignificant, reasons } = utils.isSignificantTransaction(transaction);
    
    // If transaction is significant or AI analysis is enabled, perform AI analysis
    let aiResult = { isAnomaly: false, confidence: 0, explanation: '', aiEnabled: false };
    if (isSignificant || process.env.OPENAI_API_KEY) {
      aiResult = await aiAnalysis.analyzeTransactionWithAI(transaction, receipt);
      if (aiResult.isAnomaly && aiResult.confidence > 60) {
        reasons.push(`AI detected anomaly (${aiResult.confidence}% confidence)`);
      }
    }
    
    // If transaction is significant or AI detected anomaly with high confidence
    if (isSignificant || (aiResult.isAnomaly && aiResult.confidence > 60)) {
      // Send alert via Telegram
      await telegramBot.sendTransactionAlert(transaction, receipt, reasons);
      
      // Log details to console
      const valueInAvax = utils.formatAvax(transaction.value);
      console.log(`Significant transaction detected: ${transaction.hash}`);
      console.log(`From: ${transaction.from}`);
      console.log(`To: ${transaction.to}`);
      console.log(`Value: ${valueInAvax} AVAX`);
      console.log(`Reasons: ${reasons.join(', ')}`);
      
      // If AI provided analysis, log it
      if (aiResult.aiEnabled) {
        console.log(`AI Explanation: ${aiResult.explanation}`);
      }
      
      console.log('---');
    }
  } catch (error) {
    console.error(`Error processing transaction ${transaction.hash}:`, error.message);
  }
}

/**
 * Fetches and processes the latest block from Avalanche C-Chain
 */
async function monitorLatestBlock() {
  try {
    // Get latest block number
    const blockNumber = await utils.getLatestBlockNumber();
    
    // Skip if this block has already been processed
    if (blockNumber === lastProcessedBlock) {
      console.log(`Block ${parseInt(blockNumber, 16)} already processed, waiting for new block...`);
      return;
    }
    
    console.log(`Processing block ${parseInt(blockNumber, 16)}...`);
    
    // Get block details with transactions
    const block = await utils.getBlockByNumber(blockNumber);
    
    // Process each transaction in the block
    if (block && block.transactions && block.transactions.length > 0) {
      console.log(`Found ${block.transactions.length} transactions in block ${parseInt(blockNumber, 16)}`);
      
      // Process transactions sequentially to avoid rate limiting
      for (const transaction of block.transactions) {
        await processTransaction(transaction);
      }
    } else {
      console.log(`No transactions in block ${parseInt(blockNumber, 16)}`);
    }
    
    // Update last processed block
    lastProcessedBlock = blockNumber;
    
  } catch (error) {
    console.error('Error monitoring latest block:', error.message);
  }
}

/**
 * Main function to start the monitoring process
 */
async function startMonitoring() {
  try {
    console.log('Starting Avalanche AI Monitoring Agent...');
    
    // Initialize Telegram bot
    await telegramBot.initializeBot();
    
    // Initial monitoring run
    await monitorLatestBlock();
    
    // Set up interval for continuous monitoring
    const intervalSeconds = parseInt(process.env.MONITORING_INTERVAL_SECONDS) || 30;
    console.log(`Setting up monitoring interval: ${intervalSeconds} seconds`);
    
    setInterval(async () => {
      await monitorLatestBlock();
    }, intervalSeconds * 1000);
    
  } catch (error) {
    console.error('Error starting monitoring:', error.message);
  }
}

// Start the monitoring process
startMonitoring(); 