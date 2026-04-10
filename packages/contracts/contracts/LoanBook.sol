// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract LoanBook is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum LoanState {
        draft_application,
        submitted,
        under_review,
        approved,
        rejected,
        awaiting_funding,
        active,
        grace_period,
        delinquent,
        defaulted,
        liquidating,
        closed
    }

    enum CollateralState {
        pending_lock,
        locked,
        margin_warning,
        liquidation_review,
        liquidating,
        released,
        seized
    }

    struct LoanRecord {
        address borrower;
        address borrowAsset;
        address collateralAsset;
        uint256 principalAmount;
        uint256 collateralAmount;
        uint256 serviceFeeAmount;
        uint256 outstandingPrincipalAmount;
        uint256 outstandingServiceFeeAmount;
        uint256 installmentAmount;
        uint256 installmentCount;
        uint256 termMonths;
        uint256 nextDueAt;
        bool autopayEnabled;
        LoanState state;
        CollateralState collateralState;
    }

    uint256 public loanCount;
    mapping(uint256 => LoanRecord) public loans;

    event LoanCreated(
        uint256 indexed loanId,
        address indexed borrower,
        address indexed borrowAsset,
        address collateralAsset,
        uint256 principalAmount,
        uint256 collateralAmount,
        uint256 serviceFeeAmount
    );
    event CollateralLocked(
        uint256 indexed loanId,
        address indexed collateralAsset,
        uint256 amount
    );
    event LoanFunded(
        uint256 indexed loanId,
        address indexed borrowAsset,
        uint256 principalAmount,
        uint256 nextDueAt
    );
    event RepaymentRecorded(
        uint256 indexed loanId,
        uint256 amount,
        uint256 principalAppliedAmount,
        uint256 serviceFeeAppliedAmount,
        uint256 outstandingPrincipalAmount,
        uint256 outstandingServiceFeeAmount
    );
    event LoanGracePeriodStarted(uint256 indexed loanId, uint256 gracePeriodEndsAt);
    event LoanDefaulted(uint256 indexed loanId);
    event LiquidationReviewStarted(uint256 indexed loanId);
    event LiquidationApproved(uint256 indexed loanId);
    event LiquidationExecuted(
        uint256 indexed loanId,
        uint256 recoveredAmount,
        uint256 shortfallAmount
    );
    event CollateralReleased(
        uint256 indexed loanId,
        address indexed collateralAsset,
        uint256 amount
    );
    event LoanClosed(uint256 indexed loanId);

    constructor() Ownable(msg.sender) {}

    function createLoan(
        address borrower,
        address borrowAsset,
        address collateralAsset,
        uint256 principalAmount,
        uint256 collateralAmount,
        uint256 serviceFeeAmount,
        uint256 installmentAmount,
        uint256 installmentCount,
        uint256 termMonths,
        bool autopayEnabled
    ) external onlyOwner returns (uint256) {
        require(borrower != address(0), "Borrower is required");
        require(principalAmount > 0, "Principal amount must be positive");
        require(collateralAmount > 0, "Collateral amount must be positive");
        require(installmentAmount > 0, "Installment amount must be positive");
        require(installmentCount > 0, "Installment count must be positive");
        require(termMonths > 0, "Term must be positive");

        loanCount += 1;
        loans[loanCount] = LoanRecord({
            borrower: borrower,
            borrowAsset: borrowAsset,
            collateralAsset: collateralAsset,
            principalAmount: principalAmount,
            collateralAmount: collateralAmount,
            serviceFeeAmount: serviceFeeAmount,
            outstandingPrincipalAmount: principalAmount,
            outstandingServiceFeeAmount: serviceFeeAmount,
            installmentAmount: installmentAmount,
            installmentCount: installmentCount,
            termMonths: termMonths,
            nextDueAt: 0,
            autopayEnabled: autopayEnabled,
            state: LoanState.awaiting_funding,
            collateralState: CollateralState.pending_lock
        });

        emit LoanCreated(
            loanCount,
            borrower,
            borrowAsset,
            collateralAsset,
            principalAmount,
            collateralAmount,
            serviceFeeAmount
        );

        return loanCount;
    }

    function lockCollateral(uint256 loanId, uint256 amount)
        external
        payable
        onlyOwner
        nonReentrant
    {
        LoanRecord storage loan = _requireLoanAwaitingFunding(loanId);
        require(loan.collateralState == CollateralState.pending_lock, "Collateral already locked");
        require(amount == loan.collateralAmount, "Collateral amount mismatch");

        if (loan.collateralAsset == address(0)) {
            require(msg.value == amount, "ETH collateral amount mismatch");
        } else {
            require(msg.value == 0, "Unexpected ETH collateral");
            IERC20(loan.collateralAsset).safeTransferFrom(msg.sender, address(this), amount);
        }

        loan.collateralState = CollateralState.locked;

        emit CollateralLocked(loanId, loan.collateralAsset, amount);
    }

    function fundLoan(uint256 loanId, uint256 firstDueAt)
        external
        payable
        onlyOwner
        nonReentrant
    {
        LoanRecord storage loan = _requireLoanAwaitingFunding(loanId);
        require(loan.collateralState == CollateralState.locked, "Collateral must be locked first");
        require(firstDueAt > block.timestamp, "First due date must be in the future");

        if (loan.borrowAsset == address(0)) {
            require(msg.value == loan.principalAmount, "ETH funding amount mismatch");
            (bool sent, ) = payable(loan.borrower).call{value: loan.principalAmount}("");
            require(sent, "ETH funding transfer failed");
        } else {
            require(msg.value == 0, "Unexpected ETH funding");
            IERC20(loan.borrowAsset).safeTransferFrom(
                msg.sender,
                loan.borrower,
                loan.principalAmount
            );
        }

        loan.state = LoanState.active;
        loan.nextDueAt = firstDueAt;

        emit LoanFunded(loanId, loan.borrowAsset, loan.principalAmount, firstDueAt);
    }

    function recordRepayment(uint256 loanId, uint256 amount)
        external
        payable
        onlyOwner
        nonReentrant
    {
        LoanRecord storage loan = _requireActiveLoan(loanId);
        require(amount > 0, "Repayment amount must be positive");

        if (loan.borrowAsset == address(0)) {
            require(msg.value == amount, "ETH repayment amount mismatch");
        } else {
            require(msg.value == 0, "Unexpected ETH repayment");
            IERC20(loan.borrowAsset).safeTransferFrom(msg.sender, address(this), amount);
        }

        uint256 remaining = amount;
        uint256 serviceFeeApplied = 0;
        uint256 principalApplied = 0;

        if (loan.outstandingServiceFeeAmount > 0) {
            serviceFeeApplied = remaining > loan.outstandingServiceFeeAmount
                ? loan.outstandingServiceFeeAmount
                : remaining;
            loan.outstandingServiceFeeAmount -= serviceFeeApplied;
            remaining -= serviceFeeApplied;
        }

        if (remaining > 0 && loan.outstandingPrincipalAmount > 0) {
            principalApplied = remaining > loan.outstandingPrincipalAmount
                ? loan.outstandingPrincipalAmount
                : remaining;
            loan.outstandingPrincipalAmount -= principalApplied;
        }

        if (
            loan.outstandingPrincipalAmount == 0 &&
            loan.outstandingServiceFeeAmount == 0
        ) {
            loan.state = LoanState.closed;
            emit LoanClosed(loanId);
        }

        emit RepaymentRecorded(
            loanId,
            amount,
            principalApplied,
            serviceFeeApplied,
            loan.outstandingPrincipalAmount,
            loan.outstandingServiceFeeAmount
        );
    }

    function startGracePeriod(uint256 loanId, uint256 gracePeriodEndsAt) external onlyOwner {
        LoanRecord storage loan = _requireExistingLoan(loanId);
        require(
            loan.state == LoanState.active || loan.state == LoanState.grace_period,
            "Loan is not eligible for grace period"
        );
        require(gracePeriodEndsAt > block.timestamp, "Grace period end must be in the future");
        loan.state = LoanState.grace_period;
        emit LoanGracePeriodStarted(loanId, gracePeriodEndsAt);
    }

    function markDefaulted(uint256 loanId) external onlyOwner {
        LoanRecord storage loan = _requireExistingLoan(loanId);
        require(
            loan.state == LoanState.grace_period || loan.state == LoanState.delinquent,
            "Loan is not eligible for default"
        );
        loan.state = LoanState.defaulted;
        emit LoanDefaulted(loanId);
    }

    function startLiquidationReview(uint256 loanId) external onlyOwner {
        LoanRecord storage loan = _requireExistingLoan(loanId);
        require(
            loan.state == LoanState.defaulted || loan.state == LoanState.delinquent,
            "Loan is not eligible for liquidation review"
        );
        loan.collateralState = CollateralState.liquidation_review;
        emit LiquidationReviewStarted(loanId);
    }

    function approveLiquidation(uint256 loanId) external onlyOwner {
        LoanRecord storage loan = _requireExistingLoan(loanId);
        require(
            loan.collateralState == CollateralState.liquidation_review,
            "Liquidation review not active"
        );
        loan.collateralState = CollateralState.liquidating;
        loan.state = LoanState.liquidating;
        emit LiquidationApproved(loanId);
    }

    function executeLiquidation(
        uint256 loanId,
        uint256 recoveredAmount,
        uint256 shortfallAmount
    ) external onlyOwner nonReentrant {
        LoanRecord storage loan = _requireExistingLoan(loanId);
        require(
            loan.collateralState == CollateralState.liquidating,
            "Liquidation is not approved"
        );

        if (loan.collateralAsset == address(0)) {
            (bool sent, ) = payable(owner()).call{value: loan.collateralAmount}("");
            require(sent, "ETH liquidation transfer failed");
        } else {
            IERC20(loan.collateralAsset).safeTransfer(owner(), loan.collateralAmount);
        }

        loan.collateralState = CollateralState.seized;
        loan.state = LoanState.closed;
        loan.outstandingPrincipalAmount = 0;
        loan.outstandingServiceFeeAmount = 0;

        emit LiquidationExecuted(loanId, recoveredAmount, shortfallAmount);
        emit LoanClosed(loanId);
    }

    function releaseCollateral(uint256 loanId) external onlyOwner nonReentrant {
        LoanRecord storage loan = _requireExistingLoan(loanId);
        require(loan.state == LoanState.closed, "Loan must be closed");
        require(loan.collateralState == CollateralState.locked, "Collateral is not releasable");

        if (loan.collateralAsset == address(0)) {
            (bool sent, ) = payable(loan.borrower).call{value: loan.collateralAmount}("");
            require(sent, "ETH collateral release failed");
        } else {
            IERC20(loan.collateralAsset).safeTransfer(loan.borrower, loan.collateralAmount);
        }

        loan.collateralState = CollateralState.released;

        emit CollateralReleased(loanId, loan.collateralAsset, loan.collateralAmount);
    }

    function _requireExistingLoan(uint256 loanId)
        internal
        view
        returns (LoanRecord storage)
    {
        require(loanId > 0 && loanId <= loanCount, "Invalid loan ID");
        return loans[loanId];
    }

    function _requireLoanAwaitingFunding(uint256 loanId)
        internal
        view
        returns (LoanRecord storage)
    {
        LoanRecord storage loan = _requireExistingLoan(loanId);
        require(loan.state == LoanState.awaiting_funding, "Loan is not awaiting funding");
        return loan;
    }

    function _requireActiveLoan(uint256 loanId)
        internal
        view
        returns (LoanRecord storage)
    {
        LoanRecord storage loan = _requireExistingLoan(loanId);
        require(
            loan.state == LoanState.active || loan.state == LoanState.grace_period,
            "Loan is not active"
        );
        return loan;
    }
}
