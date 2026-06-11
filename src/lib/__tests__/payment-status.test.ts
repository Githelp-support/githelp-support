import { describe, it, expect } from "vitest";
import { connectStatusLabel } from "../payment-status";

describe("connectStatusLabel", () => {
  it("returns 'Not set up' when there is no Stripe account id", () => {
    const r = connectStatusLabel({
      stripe_account_id: null,
      stripe_details_submitted: false,
      stripe_charges_enabled: false,
      stripe_payouts_enabled: false,
    });
    expect(r.label).toBe("Not set up");
    expect(r.variant).toBe("inactive");
  });

  it("returns 'Pending verification' when an account exists but details aren't submitted", () => {
    const r = connectStatusLabel({
      stripe_account_id: "acct_x",
      stripe_details_submitted: false,
      stripe_charges_enabled: false,
      stripe_payouts_enabled: false,
    });
    expect(r.label).toBe("Pending verification");
    expect(r.variant).toBe("pending");
  });

  it("returns 'Active' when details are submitted and both charges + payouts are enabled", () => {
    const r = connectStatusLabel({
      stripe_account_id: "acct_x",
      stripe_details_submitted: true,
      stripe_charges_enabled: true,
      stripe_payouts_enabled: true,
    });
    expect(r.label).toBe("Active");
    expect(r.variant).toBe("active");
  });

  it("returns 'Restricted' when details are submitted but charges or payouts are disabled", () => {
    const r = connectStatusLabel({
      stripe_account_id: "acct_x",
      stripe_details_submitted: true,
      stripe_charges_enabled: true,
      stripe_payouts_enabled: false,
    });
    expect(r.label).toBe("Restricted");
    expect(r.variant).toBe("warning");
  });
});
