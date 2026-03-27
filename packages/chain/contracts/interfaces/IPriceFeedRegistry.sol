// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity ^0.8.28;

/// @title IPriceFeedRegistry
/// @notice Interface for the centralized price feed registry
interface IPriceFeedRegistry {
    /// @notice Get price data for a token (Chainlink AggregatorV3Interface compatible)
    /// @param token The token address to get price for
    /// @return roundId Round ID
    /// @return answer The price (8 decimals)
    /// @return startedAt Timestamp
    /// @return updatedAt Timestamp of price update
    /// @return answeredInRound Answered in round
    function latestRoundData(address token) external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
    
    /// @notice Check if a token is supported
    /// @param token The token address
    /// @return Whether the token has a configured feed
    function isSupported(address token) external view returns (bool);
    
    /// @notice Get decimals
    /// @return The number of decimals (always 8)
    function decimals() external view returns (uint8);
}
