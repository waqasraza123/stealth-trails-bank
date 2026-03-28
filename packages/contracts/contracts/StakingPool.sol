// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./PoolManagement.sol";
import "./StakingOperations.sol";

contract StakingPool is PoolManagement, StakingOperations {
    constructor() Ownable(msg.sender) {
    }

    function getStakedBalance(address _user, uint256 poolId) external view returns (uint256) {
        return stakers[_user][poolId].amountStaked;
    }

    function getPendingReward(address _user, uint256 poolId) external view returns (uint256) {
        return calculateReward(_user, poolId);
    }

    function getTotalStaked(uint256 poolId) external view returns (uint256) {
        return pools[poolId].totalStaked;
    }
}