import { useEffect, useMemo, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { LoadingButton } from "@/components/ui/loading-button";
import { toast } from "@/components/ui/use-toast";
import { CustomerAssetBalance } from "@/hooks/balances/useMyBalances";
import { SupportedAsset } from "@/hooks/assets/useSupportedAssets";
import {
  CreateWithdrawalIntentResult,
  useCreateWithdrawalIntent
} from "@/hooks/transaction-intents/useCreateWithdrawalIntent";
import { readApiErrorMessage } from "@/lib/api";
import {
  buildRequestIdempotencyKey,
  compareDecimalStrings,
  formatTokenAmount,
  isEthereumAddress,
  isPositiveDecimalString
} from "@/lib/customer-finance";
import { AlertTriangle, ArrowDownRight } from "lucide-react";

type WithdrawCardProps = {
  walletAddress: string | null;
  assets: SupportedAsset[];
  balances: CustomerAssetBalance[];
  isAssetsLoading: boolean;
  isBalancesLoading: boolean;
  assetsErrorMessage: string | null;
  balancesErrorMessage: string | null;
};

const WithdrawCard = ({
  walletAddress,
  assets,
  balances,
  isAssetsLoading,
  isBalancesLoading,
  assetsErrorMessage,
  balancesErrorMessage
}: WithdrawCardProps) => {
  const createWithdrawalIntent = useCreateWithdrawalIntent();
  const [selectedAssetSymbol, setSelectedAssetSymbol] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [latestRequest, setLatestRequest] =
    useState<CreateWithdrawalIntentResult | null>(null);
  const lastSubmissionRef = useRef<{
    signature: string;
    idempotencyKey: string;
  } | null>(null);

  useEffect(() => {
    if (assets.length > 0 && !selectedAssetSymbol) {
      setSelectedAssetSymbol(assets[0].symbol);
    }
  }, [assets, selectedAssetSymbol]);

  const selectedBalance = useMemo(
    () =>
      balances.find((balance) => balance.asset.symbol === selectedAssetSymbol) ??
      null,
    [balances, selectedAssetSymbol]
  );

  function getIdempotencyKey(signature: string): string {
    if (lastSubmissionRef.current?.signature === signature) {
      return lastSubmissionRef.current.idempotencyKey;
    }

    const idempotencyKey = buildRequestIdempotencyKey("withdraw_req");
    lastSubmissionRef.current = {
      signature,
      idempotencyKey
    };

    return idempotencyKey;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedAddress = withdrawAddress.trim();
    const normalizedAmount = withdrawAmount.trim();

    if (!selectedAssetSymbol) {
      setFormError("Select an asset before creating a withdrawal request.");
      return;
    }

    if (!isEthereumAddress(normalizedAddress)) {
      setFormError("Destination address must be a valid EVM address.");
      return;
    }

    if (walletAddress && normalizedAddress.toLowerCase() === walletAddress.toLowerCase()) {
      setFormError(
        "Destination address must be different from your managed wallet address."
      );
      return;
    }

    if (!isPositiveDecimalString(normalizedAmount)) {
      setFormError(
        "Amount must be a positive decimal string with up to 18 decimal places."
      );
      return;
    }

    const availableBalance = selectedBalance?.availableBalance ?? "0";

    if (compareDecimalStrings(normalizedAmount, availableBalance) === 1) {
      setFormError(
        `Requested amount exceeds the available balance of ${formatTokenAmount(
          availableBalance
        )} ${selectedAssetSymbol}.`
      );
      return;
    }

    setFormError(null);

    const requestSignature = JSON.stringify({
      assetSymbol: selectedAssetSymbol,
      amount: normalizedAmount,
      destinationAddress: normalizedAddress.toLowerCase()
    });

    try {
      const result = await createWithdrawalIntent.mutateAsync({
        idempotencyKey: getIdempotencyKey(requestSignature),
        assetSymbol: selectedAssetSymbol,
        amount: normalizedAmount,
        destinationAddress: normalizedAddress
      });

      setLatestRequest(result);
      setWithdrawAmount("");
      setWithdrawAddress("");
      lastSubmissionRef.current = null;

      toast({
        title: result.idempotencyReused
          ? "Withdrawal request reused"
          : "Withdrawal request created",
        description: `${formatTokenAmount(
          result.intent.requestedAmount
        )} ${result.intent.asset.symbol} has moved into managed pending review.`
      });
    } catch (error) {
      const message = readApiErrorMessage(
        error,
        "Failed to create withdrawal request."
      );
      setFormError(message);

      toast({
        title: "Withdrawal request failed",
        description: message,
        variant: "destructive"
      });
    }
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowDownRight className="h-5 w-5 text-destructive" />
          Managed Withdrawal
        </CardTitle>
        <CardDescription>
          Submit a withdrawal request to move available balance into managed review and pending custody execution.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            Balance reservation behavior
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            A successful withdrawal request immediately moves the requested amount from available balance into pending balance while review is in progress.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="withdraw-asset">
              Asset
            </label>
            <select
              id="withdraw-asset"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              value={selectedAssetSymbol}
              disabled={isAssetsLoading || assets.length === 0}
              onChange={(event) => setSelectedAssetSymbol(event.target.value)}
            >
              {assets.length === 0 ? (
                <option value="">
                  {isAssetsLoading ? "Loading assets..." : "No supported assets"}
                </option>
              ) : null}
              {assets.map((asset) => (
                <option key={asset.id} value={asset.symbol}>
                  {asset.displayName} ({asset.symbol})
                </option>
              ))}
            </select>
            <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-muted-foreground">
              Available:{" "}
              <span className="font-medium text-foreground">
                {isBalancesLoading
                  ? "Loading..."
                  : `${formatTokenAmount(
                      selectedBalance?.availableBalance ?? "0"
                    )} ${selectedAssetSymbol || ""}`.trim()}
              </span>
              {" · "}
              Pending:{" "}
              <span className="font-medium text-foreground">
                {isBalancesLoading
                  ? "Loading..."
                  : `${formatTokenAmount(
                      selectedBalance?.pendingBalance ?? "0"
                    )} ${selectedAssetSymbol || ""}`.trim()}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="withdraw-address">
              Destination Address
            </label>
            <Input
              id="withdraw-address"
              placeholder="0x..."
              value={withdrawAddress}
              onChange={(event) => setWithdrawAddress(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="withdraw-amount">
              Amount
            </label>
            <Input
              id="withdraw-amount"
              inputMode="decimal"
              placeholder="0.00"
              value={withdrawAmount}
              onChange={(event) => setWithdrawAmount(event.target.value)}
            />
          </div>

          {assetsErrorMessage ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {assetsErrorMessage}
            </div>
          ) : null}

          {balancesErrorMessage ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {balancesErrorMessage}
            </div>
          ) : null}

          {formError ? (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {formError}
            </div>
          ) : null}

          <LoadingButton
            type="submit"
            className="w-full"
            loading={createWithdrawalIntent.isPending}
            disabled={
              isAssetsLoading ||
              isBalancesLoading ||
              assets.length === 0 ||
              Boolean(assetsErrorMessage) ||
              Boolean(balancesErrorMessage)
            }
          >
            Create Withdrawal Request
          </LoadingButton>
        </form>

        {latestRequest ? (
          <div className="rounded-lg border border-mint-200 bg-mint-50/60 p-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <p className="font-medium text-foreground">
                Latest withdrawal request
              </p>
              <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700">
                {latestRequest.intent.status}
              </span>
            </div>
            <p className="mt-2 text-muted-foreground">
              {formatTokenAmount(latestRequest.intent.requestedAmount)}{" "}
              {latestRequest.intent.asset.symbol} to{" "}
              {latestRequest.intent.externalAddress ?? "N/A"}
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              Request ID: {latestRequest.intent.id}
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default WithdrawCard;
