import { Link } from "react-router-dom";
import { ArrowLeft, Shield, ShieldAlert } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const CreatePool = () => {
  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold text-apple-blue">
            Pool Governance
          </h1>
          <Button asChild variant="outline">
            <Link to="/staking">
              <ArrowLeft className="h-4 w-4" />
              Back to Staking
            </Link>
          </Button>
        </div>

        <Alert className="border-apple-blue bg-apple-soft-blue">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Internal-only workflow</AlertTitle>
          <AlertDescription>
            Staking pool creation is not available from the customer portal.
            This route is preserved only to prevent the old mocked flow from
            pretending that customers can create validator pools directly.
          </AlertDescription>
        </Alert>

        <Card className="glass-card mx-auto max-w-3xl p-8">
          <div className="space-y-6">
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 h-5 w-5 text-mint-700" />
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  Why this action is unavailable
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Pool creation currently depends on backend-controlled contract
                  writes and governance assumptions that are not appropriate for
                  a customer-facing interface. Keeping a fake creation form here
                  would misrepresent the actual operating model.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium text-foreground">
                  Governance boundary
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Pool creation should move through an internal operator and
                  governance path, not a browser-only customer flow.
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium text-foreground">
                  Contract execution
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  The current contract write path is server-side and not yet a
                  production-safe customer execution model.
                </p>
              </div>
              <div className="rounded-lg border p-4">
                <p className="text-sm font-medium text-foreground">
                  Operational safety
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Product launch posture requires policy, audit, and treasury
                  controls before pool creation can be exposed directly.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              The customer staking page shows the live pool registry and current
              product availability. Pool creation should reappear here only
              after the internal governance and release boundary exists.
            </div>
          </div>
        </Card>
      </div>
    </Layout>
  );
};

export default CreatePool;
