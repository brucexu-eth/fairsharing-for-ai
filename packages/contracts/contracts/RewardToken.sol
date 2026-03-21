// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title RewardToken
/// @notice Project-scoped ERC-20 reward token. Only the FSProject contract can mint.
contract RewardToken is ERC20 {
    address public immutable project;

    constructor(
        string memory name,
        string memory symbol,
        address _project
    ) ERC20(name, symbol) {
        project = _project;
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == project, "RewardToken: only project can mint");
        _mint(to, amount);
    }
}
