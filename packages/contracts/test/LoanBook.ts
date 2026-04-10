import { expect } from "chai";
import "@nomicfoundation/hardhat-ethers";
import hre from "hardhat";

describe("LoanBook", function () {
  let loanBook: any;
  let owner: any;
  let borrower: any;
  let treasury: any;
  let usdc: any;

  beforeEach(async function () {
    [owner, borrower, treasury] = await hre.ethers.getSigners();

    const TokenFactory = await hre.ethers.getContractFactory("TestToken");
    usdc = await TokenFactory.deploy();

    const LoanBookFactory = await hre.ethers.getContractFactory("LoanBook");
    loanBook = await LoanBookFactory.deploy();

    await usdc.mint(owner.address, hre.ethers.parseUnits("500000", 18));
    await usdc.mint(treasury.address, hre.ethers.parseUnits("500000", 18));
  });

  it("creates, collateralizes, funds, repays, and closes ETH-backed loans", async function () {
    const principal = hre.ethers.parseEther("2");
    const collateral = hre.ethers.parseEther("5");
    const serviceFee = hre.ethers.parseEther("0.1");

    await loanBook.createLoan(
      borrower.address,
      hre.ethers.ZeroAddress,
      hre.ethers.ZeroAddress,
      principal,
      collateral,
      serviceFee,
      hre.ethers.parseEther("0.7"),
      3,
      3,
      true
    );

    await loanBook.lockCollateral(1, collateral, { value: collateral });
    await loanBook.fundLoan(1, BigInt(Math.floor(Date.now() / 1000) + 86400), {
      value: principal
    });

    const record = await loanBook.loans(1);
    expect(record.state).to.equal(6n);
    expect(record.collateralState).to.equal(1n);

    await loanBook.recordRepayment(1, hre.ethers.parseEther("2.1"), {
      value: hre.ethers.parseEther("2.1")
    });

    const closedRecord = await loanBook.loans(1);
    expect(closedRecord.state).to.equal(11n);

    await loanBook.releaseCollateral(1);
    const releasedRecord = await loanBook.loans(1);
    expect(releasedRecord.collateralState).to.equal(5n);
  });

  it("supports ERC20 funding and liquidation execution", async function () {
    const principal = hre.ethers.parseUnits("1000", 18);
    const collateral = hre.ethers.parseUnits("1500", 18);

    await loanBook.createLoan(
      borrower.address,
      usdc.target,
      usdc.target,
      principal,
      collateral,
      hre.ethers.parseUnits("10", 18),
      hre.ethers.parseUnits("252.5", 18),
      4,
      4,
      true
    );

    await usdc.mint(owner.address, collateral);
    await usdc.approve(loanBook.target, collateral);
    await loanBook.lockCollateral(1, collateral);

    await usdc.approve(loanBook.target, principal);
    await loanBook.fundLoan(1, BigInt(Math.floor(Date.now() / 1000) + 86400));

    await loanBook.startGracePeriod(1, BigInt(Math.floor(Date.now() / 1000) + 86400 * 7));
    await loanBook.markDefaulted(1);
    await loanBook.startLiquidationReview(1);
    await loanBook.approveLiquidation(1);
    await loanBook.executeLiquidation(1, collateral, 0);

    const record = await loanBook.loans(1);
    expect(record.state).to.equal(11n);
    expect(record.collateralState).to.equal(6n);
  });
});
