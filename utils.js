require('dotenv').config();
const axios = require('axios');
const { ethers } = require('ethers');

/**
 * Formats an AVAX amount from Wei to AVAX with proper decimal places
 * @param {string} weiAmount - Amount in Wei as a string
 * @param {number} decimals - Number of decimal places to display
 * @returns {string} - Formatted AVAX amount
 */
function formatAvax(weiAmount, decimals = 6) {
  const avaxAmount = ethers.utils.formatEther(weiAmount);
  return parseFloat(avaxAmount).toFixed(decimals);
}

/**
 * Calculates gas fee in AVAX
 * @param {string} gasUsed - Gas used
 * @param {string} gasPrice - Gas price in Wei
 * @returns {string} - Gas fee in AVAX
 */
function calculateGasFee(gasUsed, gasPrice) {
  const gasFeeWei = BigInt(gasUsed) * BigInt(gasPrice);
  return formatAvax(gasFeeWei.toString());
}

/**
 * Check if a transaction exceeds configured thresholds
 * @param {object} transaction - Transaction object
 * @returns {object} - Result object with isSignificant flag and reasons
 */
function isSignificantTransaction(transaction) {
  const valueAvax = parseFloat(formatAvax(transaction.value));
  const gasFeeAvax = parseFloat(calculateGasFee(transaction.gasUsed || '0', transaction.gasPrice));
  
  const thresholdValue = parseFloat(process.env.TRANSACTION_THRESHOLD_AVAX);
  const thresholdGas = parseFloat(process.env.GAS_FEE_THRESHOLD_AVAX);
  
  const reasons = [];
  
  if (valueAvax > thresholdValue) {
    reasons.push(`Large transaction: ${valueAvax} AVAX`);
  }
  
  if (gasFeeAvax > thresholdGas) {
    reasons.push(`High gas fee: ${gasFeeAvax} AVAX`);
  }
  
  return {
    isSignificant: reasons.length > 0,
    reasons
  };
}

/**
 * Shortens an address for display
 * @param {string} address - The blockchain address
 * @returns {string} - Shortened address (e.g., 0x1234...5678)
 */
function shortenAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Makes an RPC call to the Avalanche C-Chain
 * @param {string} method - JSON-RPC method
 * @param {Array} params - Parameters for the method
 * @returns {Promise<any>} - Response data
 */
async function avalancheRpcCall(method, params = []) {
  try {
    const response = await axios.post(
      process.env.AVALANCHE_API_URL,
      {
        jsonrpc: '2.0',
        id: 1,
        method,
        params
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
    
    return response.data.result;
  } catch (error) {
    console.error(`RPC call error (${method}):`, error.message);
    throw error;
  }
}

/**
 * Gets the latest block number from Avalanche C-Chain
 * @returns {Promise<string>} - Latest block number in hex
 */
async function getLatestBlockNumber() {
  return await avalancheRpcCall('eth_blockNumber');
}

/**
 * Gets block details by block number
 * @param {string} blockNumber - Block number in hex
 * @returns {Promise<object>} - Block details
 */
async function getBlockByNumber(blockNumber) {
  return await avalancheRpcCall('eth_getBlockByNumber', [blockNumber, true]);
}

/**
 * Gets transaction receipt
 * @param {string} txHash - Transaction hash
 * @returns {Promise<object>} - Transaction receipt
 */
async function getTransactionReceipt(txHash) {
  return await avalancheRpcCall('eth_getTransactionReceipt', [txHash]);
}

module.exports = {
  formatAvax,
  calculateGasFee,
  isSignificantTransaction,
  shortenAddress,
  avalancheRpcCall,
  getLatestBlockNumber,
  getBlockByNumber,
  getTransactionReceipt
}; 