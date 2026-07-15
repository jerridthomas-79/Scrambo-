import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Card } from "../../src/components/Card";

describe("Card interaction", () => {
  it("allows an empty discard destination when explicitly enabled", () => {
    const onClick = vi.fn();
    render(<Card card={null} allowEmpty onClick={onClick} label="Empty discard pile" />);
    const destination = screen.getByRole("button", { name: "Empty discard pile" });
    expect(destination).toBeEnabled();
    fireEvent.click(destination);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("keeps ordinary empty card slots disabled", () => {
    render(<Card card={null} label="Empty slot" />);
    expect(screen.getByRole("button", { name: "Empty slot" })).toBeDisabled();
  });
});
