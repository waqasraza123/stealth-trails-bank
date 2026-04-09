import { expect } from "chai";
import "@nomicfoundation/hardhat-ethers";
import hre from "hardhat";

const ONE_YEAR = 365 * 24 * 60 * 60;
const REWARD_TOLERANCE = hre.ethers.parseEther("0.000001");

async function increaseTime(seconds: number): Promise<void> {
  await hre.network.provider.send("evm_increaseTime", [seconds]);
  await hre.network.provider.send("evm_mine");
}

async function expectRevert(
  operation: Promise<unknown>,
  expectedMessage: string
): Promise<void> {
  try {
    await operation;
    expect.fail(`Expected revert containing: ${expectedMessage}`);
  } catch (error) {
    expect((error as Error).message).to.include(expectedMessage);
  }
}

function expectApproxEqual(
  actual: bigint,
  expected: bigint,
  tolerance: bigint = REWARD_TOLERANCE
): void {
  const delta = actual >= expected ? actual - expected : expected - actual;
  expect(delta).to.be.lte(tolerance);
}

describe("StakingPool", function () {
  let stakingPool: any;
  let owner: any;
  let addr1: any;
  let addr2: any;

  beforeEach(async function () {
    const StakingPoolFactory =
      await hre.ethers.getContractFactory("StakingPool");
    stakingPool = await StakingPoolFactory.deploy();
    [owner, addr1, addr2] = await hre.ethers.getSigners();
  });

  it("creates pools with zeroed reward accounting and live deposits by default", async function () {
    await stakingPool.createPool(10, 42);

    const pool = await stakingPool.pools(1);

    expect(pool.rewardRate).to.equal(10n);
    expect(pool.totalStaked).to.equal(0n);
    expect(pool.totalRewardsPaid).to.equal(0n);
    expect(pool.rewardReserve).to.equal(0n);
    expect(pool.depositsPaused).to.equal(false);
  });

  it("restricts pool management actions to the owner", async function () {
    await expectRevert(
      stakingPool.connect(addr1).createPool(10, 42),
      "OwnableUnauthorizedAccount"
    );

    await stakingPool.createPool(10, 42);

    await expectRevert(
      stakingPool
        .connect(addr1)
        .fundPoolRewards(1, { value: hre.ethers.parseEther("1") }),
      "OwnableUnauthorizedAccount"
    );

    await expectRevert(
      stakingPool.connect(addr1).setPoolDepositPause(1, true),
      "OwnableUnauthorizedAccount"
    );
  });

  it("funds a pool reward reserve and blocks zero-value funding", async function () {
    await stakingPool.createPool(10, 42);

    await expectRevert(
      stakingPool.fundPoolRewards(1, { value: 0n }),
      "Funding amount must be greater than 0"
    );

    await stakingPool.fundPoolRewards(1, {
      value: hre.ethers.parseEther("2")
    });

    const pool = await stakingPool.pools(1);
    expect(pool.rewardReserve).to.equal(hre.ethers.parseEther("2"));
    expect(await stakingPool.getPoolRewardReserve(1)).to.equal(
      hre.ethers.parseEther("2")
    );
  });

  it("rejects zero-value deposits and withdrawal boundary violations", async function () {
    await stakingPool.createPool(10, 42);

    await expectRevert(
      stakingPool.connect(addr1).deposit(1, 0n, {
        value: 0n
      }),
      "Amount must be greater than 0"
    );

    const depositAmount = hre.ethers.parseEther("1");
    await stakingPool.connect(addr1).deposit(1, depositAmount, {
      value: depositAmount
    });

    await expectRevert(
      stakingPool.connect(addr1).withdraw(1, 0n),
      "Withdrawal amount must be greater than zero"
    );
    await expectRevert(
      stakingPool.connect(addr1).withdraw(1, hre.ethers.parseEther("2")),
      "Insufficient staked balance"
    );
  });

  it("pauses deposits without blocking later exits", async function () {
    const depositAmount = hre.ethers.parseEther("1");

    await stakingPool.createPool(10, 42);
    await stakingPool.connect(addr1).deposit(1, depositAmount, {
      value: depositAmount
    });

    await stakingPool.setPoolDepositPause(1, true);

    expect(await stakingPool.arePoolDepositsPaused(1)).to.equal(true);

    await expectRevert(
      stakingPool.connect(addr2).deposit(1, depositAmount, {
        value: depositAmount
      }),
      "Pool deposits are paused"
    );

    await stakingPool.fundPoolRewards(1, {
      value: hre.ethers.parseEther("1")
    });
    await increaseTime(ONE_YEAR);

    await stakingPool.connect(addr1).claimReward(1);

    const pool = await stakingPool.pools(1);
    expectApproxEqual(pool.totalRewardsPaid, hre.ethers.parseEther("0.1"));
  });

  it("keeps pending rewards accurate across reward checkpoints", async function () {
    const firstDeposit = hre.ethers.parseEther("10");
    const secondDeposit = hre.ethers.parseEther("10");

    await stakingPool.createPool(10, 42);
    await stakingPool.connect(addr1).deposit(1, firstDeposit, {
      value: firstDeposit
    });

    await increaseTime(ONE_YEAR / 2);
    expectApproxEqual(
      await stakingPool.getPendingReward(addr1.address, 1),
      hre.ethers.parseEther("0.5")
    );

    await stakingPool.connect(addr1).deposit(1, secondDeposit, {
      value: secondDeposit
    });

    expectApproxEqual(
      await stakingPool.getPendingReward(addr1.address, 1),
      hre.ethers.parseEther("0.5")
    );

    await increaseTime(ONE_YEAR / 2);
    expectApproxEqual(
      await stakingPool.getPendingReward(addr1.address, 1),
      hre.ethers.parseEther("1.5")
    );
  });

  it("reverts reward claims when the pool is underfunded instead of paying from principal", async function () {
    const depositAmount = hre.ethers.parseEther("10");

    await stakingPool.createPool(10, 42);
    await stakingPool.connect(addr1).deposit(1, depositAmount, {
      value: depositAmount
    });
    await increaseTime(ONE_YEAR);

    await expectRevert(
      stakingPool.connect(addr1).claimReward(1),
      "Insufficient funded rewards"
    );

    expect(await stakingPool.getStakedBalance(addr1.address, 1)).to.equal(
      depositAmount
    );
    expect(await stakingPool.getTotalStaked(1)).to.equal(depositAmount);
    expect(await hre.ethers.provider.getBalance(stakingPool.target)).to.equal(
      depositAmount
    );
  });

  it("pays funded rewards, updates reserve accounting, and leaves principal intact on reward claim", async function () {
    const depositAmount = hre.ethers.parseEther("10");
    const rewardFunding = hre.ethers.parseEther("2");

    await stakingPool.createPool(10, 42);
    await stakingPool.fundPoolRewards(1, { value: rewardFunding });
    await stakingPool.connect(addr1).deposit(1, depositAmount, {
      value: depositAmount
    });
    await increaseTime(ONE_YEAR);

    await stakingPool.connect(addr1).claimReward(1);

    const pool = await stakingPool.pools(1);

    expect(pool.totalStaked).to.equal(depositAmount);
    expectApproxEqual(pool.totalRewardsPaid, hre.ethers.parseEther("1"));
    expect(pool.rewardReserve + pool.totalRewardsPaid).to.equal(rewardFunding);
    expect(await stakingPool.getPendingReward(addr1.address, 1)).to.equal(0n);
    expect(await hre.ethers.provider.getBalance(stakingPool.target)).to.equal(
      depositAmount + pool.rewardReserve
    );
  });

  it("settles withdrawals from principal plus funded rewards and closes out contract exposure", async function () {
    const depositAmount = hre.ethers.parseEther("10");
    const rewardFunding = hre.ethers.parseEther("2");

    await stakingPool.createPool(10, 42);
    await stakingPool.fundPoolRewards(1, { value: rewardFunding });
    await stakingPool.connect(addr1).deposit(1, depositAmount, {
      value: depositAmount
    });
    await increaseTime(ONE_YEAR);

    await stakingPool.connect(addr1).withdraw(1, depositAmount);

    const pool = await stakingPool.pools(1);

    expect(pool.totalStaked).to.equal(0n);
    expectApproxEqual(pool.totalRewardsPaid, hre.ethers.parseEther("1"));
    expect(pool.rewardReserve + pool.totalRewardsPaid).to.equal(rewardFunding);
    expect(await stakingPool.getStakedBalance(addr1.address, 1)).to.equal(0n);
    expect(await stakingPool.getPendingReward(addr1.address, 1)).to.equal(0n);
    expect(await hre.ethers.provider.getBalance(stakingPool.target)).to.equal(
      pool.rewardReserve
    );
  });

  it("preserves funded rewards during emergency withdrawal and forfeits accrued rewards", async function () {
    const depositAmount = hre.ethers.parseEther("4");
    const rewardFunding = hre.ethers.parseEther("2");

    await stakingPool.createPool(10, 42);
    await stakingPool.fundPoolRewards(1, { value: rewardFunding });
    await stakingPool.connect(addr1).deposit(1, depositAmount, {
      value: depositAmount
    });
    await increaseTime(ONE_YEAR);

    await stakingPool.connect(addr1).emergencyWithdraw(1);

    const pool = await stakingPool.pools(1);

    expect(pool.totalStaked).to.equal(0n);
    expect(pool.totalRewardsPaid).to.equal(0n);
    expect(pool.rewardReserve).to.equal(rewardFunding);
    expect(await stakingPool.getStakedBalance(addr1.address, 1)).to.equal(0n);
    expect(await stakingPool.getPendingReward(addr1.address, 1)).to.equal(0n);
    expect(await hre.ethers.provider.getBalance(stakingPool.target)).to.equal(
      rewardFunding
    );
  });

  it("rejects direct ETH transfers outside explicit deposit and reward funding flows", async function () {
    await expectRevert(
      owner.sendTransaction({
        to: stakingPool.target,
        value: hre.ethers.parseEther("1")
      }),
      "Direct ETH transfer disabled"
    );
  });
});
