// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AggregatorV3Interface} from "./interfaces/AggregatorV3Interface.sol";

/// @title PriceFeedRegistry
/// @notice Centralized registry for token price feeds with hybrid Chainlink + mock support
/// @dev All Funds query this registry for prices instead of maintaining per-fund mappings
/// @author ~sidnym-ladrut (original author), work-fund-lab team
contract PriceFeedRegistry is Ownable {
    
    /// @notice Configuration for a token's price feed
    struct FeedConfig {
        address chainlinkFeed;  // Primary Chainlink feed (address(0) if none)
        int256 mockPrice;       // Fallback mock price (8 decimals)
        uint256 mockUpdatedAt;  // Timestamp of last mock price update
        bool enabled;           // Whether this token is supported
    }
    
    /// @notice Maximum staleness for Chainlink data (1 hour)
    uint256 public constant MAX_STALENESS = 3600;
    
    /// @notice Price feed decimals (Chainlink standard)
    uint8 public constant DECIMALS = 8;
    
    /// @notice Token address => feed configuration
    mapping(address => FeedConfig) public feeds;
    
    /// @notice List of all registered tokens
    address[] public registeredTokens;
    
    /// @notice Events
    event FeedConfigured(address indexed token, address chainlinkFeed, int256 mockPrice);
    event MockPriceUpdated(address indexed token, int256 newPrice);
    event FeedRemoved(address indexed token);
    
    constructor() Ownable(msg.sender) {}
    
    /// @notice Configure a price feed for a token
    /// @param token The token address
    /// @param chainlinkFeed The Chainlink feed address (address(0) for mock-only)
    /// @param mockPrice The fallback mock price (8 decimals, e.g., 100000000 = $1.00)
    function setFeed(address token, address chainlinkFeed, int256 mockPrice) external onlyOwner {
        require(token != address(0), "Invalid token address");
        require(mockPrice > 0, "Mock price must be positive");
        
        if (!feeds[token].enabled) {
            registeredTokens.push(token);
        }
        
        feeds[token] = FeedConfig({
            chainlinkFeed: chainlinkFeed,
            mockPrice: mockPrice,
            mockUpdatedAt: block.timestamp,
            enabled: true
        });
        
        emit FeedConfigured(token, chainlinkFeed, mockPrice);
    }
    
    /// @notice Update only the mock price for a token
    /// @param token The token address
    /// @param mockPrice The new mock price (8 decimals)
    function updateMockPrice(address token, int256 mockPrice) external onlyOwner {
        require(feeds[token].enabled, "Token not registered");
        require(mockPrice > 0, "Mock price must be positive");
        
        feeds[token].mockPrice = mockPrice;
        feeds[token].mockUpdatedAt = block.timestamp;
        
        emit MockPriceUpdated(token, mockPrice);
    }
    
    /// @notice Remove a token from the registry
    /// @param token The token address to remove
    function removeFeed(address token) external onlyOwner {
        require(feeds[token].enabled, "Token not registered");
        feeds[token].enabled = false;
        emit FeedRemoved(token);
    }
    
    /// @notice Get price data for a token (Chainlink AggregatorV3Interface compatible)
    /// @param token The token address to get price for
    /// @return roundId Always 1 for simplicity
    /// @return answer The price (8 decimals)
    /// @return startedAt Timestamp
    /// @return updatedAt Timestamp of price update
    /// @return answeredInRound Always 1 for simplicity
    function latestRoundData(address token) external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        FeedConfig memory config = feeds[token];
        require(config.enabled, "Token not supported");
        
        // Try Chainlink first
        if (config.chainlinkFeed != address(0)) {
            try AggregatorV3Interface(config.chainlinkFeed).latestRoundData() returns (
                uint80 clRoundId,
                int256 clAnswer,
                uint256 clStartedAt,
                uint256 clUpdatedAt,
                uint80 clAnsweredInRound
            ) {
                // Validate Chainlink data
                if (clAnswer > 0 && block.timestamp - clUpdatedAt <= MAX_STALENESS) {
                    return (clRoundId, clAnswer, clStartedAt, clUpdatedAt, clAnsweredInRound);
                }
            } catch {
                // Chainlink call failed, fall through to mock
            }
        }
        
        // Fallback to mock price
        return (1, config.mockPrice, config.mockUpdatedAt, config.mockUpdatedAt, 1);
    }
    
    /// @notice Simple price getter (convenience function)
    /// @param token The token address
    /// @return The price (8 decimals)
    function getPrice(address token) external view returns (int256) {
        (, int256 answer,,,) = this.latestRoundData(token);
        return answer;
    }
    
    /// @notice Check if a token is supported
    /// @param token The token address
    /// @return Whether the token has a configured feed
    function isSupported(address token) external view returns (bool) {
        return feeds[token].enabled;
    }
    
    /// @notice Get all registered tokens
    /// @return Array of token addresses
    function getAllTokens() external view returns (address[] memory) {
        // Count enabled tokens
        uint256 count = 0;
        for (uint256 i = 0; i < registeredTokens.length; i++) {
            if (feeds[registeredTokens[i]].enabled) {
                count++;
            }
        }
        
        // Build result array
        address[] memory result = new address[](count);
        uint256 j = 0;
        for (uint256 i = 0; i < registeredTokens.length; i++) {
            if (feeds[registeredTokens[i]].enabled) {
                result[j++] = registeredTokens[i];
            }
        }
        return result;
    }
    
    /// @notice Get decimals (for AggregatorV3Interface compatibility)
    /// @return Always 8
    function decimals() external pure returns (uint8) {
        return DECIMALS;
    }
}
