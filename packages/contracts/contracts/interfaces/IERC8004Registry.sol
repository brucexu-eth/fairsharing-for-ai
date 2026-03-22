// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IERC8004Registry
/// @notice Interface for the ERC-8004 on-chain agent identity registry.
/// @dev The real registry is an ERC-721. Set to address(0) in FSProject to skip verification (local dev).
interface IERC8004Registry {
    /// @notice Returns true if the given address has a registered ERC-8004 agent identity.
    function isRegistered(address agent) external view returns (bool);

    /// @notice Returns the number of agent NFTs owned by an address (ERC-721 balanceOf).
    function balanceOf(address owner) external view returns (uint256);

    /// @notice Returns the token URI for an agent ID (links to agent registration file).
    function tokenURI(uint256 agentId) external view returns (string memory);
}
