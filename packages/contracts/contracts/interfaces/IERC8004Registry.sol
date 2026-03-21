// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IERC8004Registry
/// @notice Minimal interface for the ERC-8004 on-chain agent identity registry.
/// @dev Set registry address to address(0) in FSProject to skip verification (useful for local dev).
interface IERC8004Registry {
    /// @notice Returns true if the given address has a registered ERC-8004 agent identity.
    function isRegistered(address agent) external view returns (bool);
}
