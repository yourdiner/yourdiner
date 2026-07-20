import { describe, expect, it } from "vitest";
import { parseHostname, buildRestaurantUrl } from "@/lib/hostname";
import { parseMiddlewareHostname } from "@/lib/middleware-hostname";

describe("custom domain hostname parsing", () => {
  it("treats platform subdomain as tenant", () => {
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = "yourdiner.in";
    expect(parseHostname("homecafe.yourdiner.in")).toEqual({
      type: "tenant",
      tenantKey: "homecafe",
    });
    expect(parseMiddlewareHostname("homecafe.yourdiner.in").type).toBe("tenant");
  });

  it("treats brand domain as custom", () => {
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = "yourdiner.in";
    expect(parseHostname("homecafe.in")).toEqual({
      type: "custom",
      hostname: "homecafe.in",
    });
    expect(parseMiddlewareHostname("www.homecafe.in")).toEqual({
      type: "custom",
      hostname: "homecafe.in",
    });
  });

  it("buildRestaurantUrl prefers ACTIVE custom domain", () => {
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = "yourdiner.in";
    expect(
      buildRestaurantUrl(
        {
          tenantKey: "homecafe",
          customDomain: "homecafe.in",
          customDomainStatus: "ACTIVE",
        },
        "/menu"
      )
    ).toBe("https://homecafe.in/menu");

    expect(
      buildRestaurantUrl(
        {
          tenantKey: "homecafe",
          customDomain: "homecafe.in",
          customDomainStatus: "PENDING",
        },
        "/menu"
      )
    ).toBe("https://homecafe.yourdiner.in/menu");
  });
});
