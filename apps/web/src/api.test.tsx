import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthProvider, SignIn } from "./auth";
import App from "./App";
import { formatMoney } from "./api";
import { AuthContext } from "./auth-context";
import { MemoryRouter } from "react-router-dom";

afterEach(() => vi.unstubAllGlobals());

describe("client authentication and formatting", () => {
  it("submits credentials to the API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ token: "test-token" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(
      <AuthProvider>
        <SignIn />
      </AuthProvider>,
    );
    await user.type(screen.getByLabelText("Email address"), "hr@example.test");
    await user.type(screen.getByLabelText("Password"), "a-long-test-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(
      await screen.findByRole("button", { name: "Sign in" }),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/login"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          email: "hr@example.test",
          password: "a-long-test-password",
        }),
      }),
    );
  });

  describe("workspace profile information", () => {
    it("renders profile information as non-interactive content", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(
            JSON.stringify({
              totalEmployees: 0,
              activeEmployees: 0,
              inactiveEmployees: 0,
              byDepartment: [],
              byCountry: [],
              salarySummary: [],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        ),
      );
      render(
        <AuthContext.Provider
          value={{
            token: "test-token",
            signIn: async () => {},
            signOut: () => {},
          }}
        >
          <MemoryRouter initialEntries={["/"]}>
            <App />
          </MemoryRouter>
        </AuthContext.Provider>,
      );
      const profileNames = await screen.findAllByText("HR Manager");
      const profileName = profileNames.find((element) =>
        element.closest(".profile-info"),
      );
      expect(profileName).toBeInTheDocument();
      expect(profileName?.closest("button")).toBeNull();
      expect(
        screen.getByRole("button", { name: "Sign out" }),
      ).toBeInTheDocument();
    });
  });

  it("formats monetary output with the requested currency", () => {
    expect(formatMoney("1000", "JPY")).toContain("¥");
    expect(formatMoney("10.25", "USD")).toContain("10.25");
    expect(formatMoney("1.005", "USD")).toContain("1.01");
  });
});
