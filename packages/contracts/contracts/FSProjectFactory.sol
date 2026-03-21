// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./FSProject.sol";

/// @title FSProjectFactory
/// @notice Deploys and tracks FSProject instances.
contract FSProjectFactory {
    /// @notice ERC-8004 registry passed to every created project. address(0) = skip identity checks.
    address public immutable erc8004Registry;

    struct ProjectInfo {
        address projectAddress;
        address creator;
        string name;
        uint256 createdAt;
    }

    ProjectInfo[] private _projects;

    event ProjectCreated(
        uint256 indexed projectId,
        address indexed projectAddress,
        address indexed creator,
        string name
    );

    constructor(address _erc8004Registry) {
        erc8004Registry = _erc8004Registry;
    }

    /// @param name        Human-readable project name.
    /// @param tokenName   Full name of the reward ERC-20 token (e.g. "My Project Reward").
    /// @param tokenSymbol Ticker symbol of the reward token (e.g. "MPR").
    function createProject(
        string calldata name,
        string calldata tokenName,
        string calldata tokenSymbol
    ) external returns (address projectAddress) {
        FSProject project = new FSProject(name, msg.sender, erc8004Registry, tokenName, tokenSymbol);
        projectAddress = address(project);

        _projects.push(
            ProjectInfo({
                projectAddress: projectAddress,
                creator: msg.sender,
                name: name,
                createdAt: block.timestamp
            })
        );

        emit ProjectCreated(_projects.length - 1, projectAddress, msg.sender, name);
    }

    function getProjects() external view returns (ProjectInfo[] memory) {
        return _projects;
    }

    function projectCount() external view returns (uint256) {
        return _projects.length;
    }
}
