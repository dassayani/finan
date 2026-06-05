/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BatchFeedbackContent } from "@/components/dashboard/batch-feedback-content";

describe("BatchFeedbackContent UI", () => {
  it("renders summary and all failures", () => {
    render(
      <BatchFeedbackContent
        summary="2/3 salvo(s). 1 falha(s) no processamento."
        failures={["Item 2: Banco inválido"]}
        tone="warn"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("2/3 salvo(s). 1 falha(s) no processamento.")).toBeInTheDocument();
    expect(screen.getByText("Item 2: Banco inválido")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entendi" })).toBeInTheDocument();
  });

  it("hides failures section when list is empty", () => {
    render(
      <BatchFeedbackContent
        summary="Tudo salvo com sucesso"
        failures={[]}
        tone="warn"
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText("Tudo salvo com sucesso")).toBeInTheDocument();
    expect(screen.queryByText(/Item \d+:/)).not.toBeInTheDocument();
  });

  it("calls onClose when user acknowledges", () => {
    const onClose = vi.fn();

    render(
      <BatchFeedbackContent
        summary="Erro no lote"
        failures={["Item 1: Falha de validação"]}
        tone="error"
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Entendi" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
