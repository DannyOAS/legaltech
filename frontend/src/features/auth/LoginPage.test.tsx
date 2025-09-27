import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import LoginPage from "./LoginPage";
import { MockAuthProvider } from "./test-utils";

test("renders login form", () => {
  render(
    <MemoryRouter>
      <MockAuthProvider>
        <LoginPage />
      </MockAuthProvider>
    </MemoryRouter>
  );
  expect(screen.getByText(/Maple Legal Portal/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
});
