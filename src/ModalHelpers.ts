import { Notice } from "obsidian";
import { validateTagName } from "./TagValidation";
import { t, tp } from "./i18n";

// ========== Modal 构建辅助函数 ==========

export function createModalOverlay(_container: HTMLElement): HTMLElement {
  const overlay = activeDocument.createElement("div");
  overlay.className = "cashlog-tag-modal-overlay";
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  return overlay;
}

export function createModalCard(overlay: HTMLElement): HTMLElement {
  const modal = activeDocument.createElement("div");
  modal.className = "cashlog-tag-modal";
  overlay.appendChild(modal);
  return modal;
}

export function createModalTitle(text: string): HTMLElement {
  const title = activeDocument.createElement("div");
  title.className = "cashlog-tag-modal-title";
  title.textContent = text;
  return title;
}

export function createModalInput(modal: HTMLElement, placeholder: string, value?: string): HTMLInputElement {
  const input = activeDocument.createElement("input");
  input.type = "text";
  input.className = "cashlog-tag-modal-input";
  if (value !== undefined) input.value = value;
  input.placeholder = placeholder;
  modal.appendChild(input);
  return input;
}

export function createModalError(modal: HTMLElement): HTMLElement {
  const errorEl = activeDocument.createElement("div");
  errorEl.className = "cashlog-tag-modal-error cashlog-hidden";
  modal.appendChild(errorEl);
  return errorEl;
}

export function createModalButtonRow(modal: HTMLElement): HTMLElement {
  const btnRow = activeDocument.createElement("div");
  btnRow.className = "cashlog-tag-modal-buttons";
  modal.appendChild(btnRow);
  return btnRow;
}

export function createModalButton(
  text: string,
  type: "primary" | "secondary",
  onClick: (btn: HTMLButtonElement) => void | Promise<void>
): HTMLButtonElement {
  const btn = activeDocument.createElement("button");
  btn.className = "cashlog-settings-btn";
  if (type === "primary") {
    btn.classList.add("cashlog-settings-btn-primary");
  } else {
    btn.classList.add("cashlog-settings-btn-secondary");
  }
  btn.textContent = text;
  btn.addEventListener("click", () => { void onClick(btn); });
  return btn;
}

export function finishModal(overlay: HTMLElement, container: HTMLElement, input: HTMLInputElement | null): void {
  container.appendChild(overlay);
  if (input) {
    activeWindow.setTimeout(() => {
      input.focus();
      input.select();
    }, 50);
  }
}

// 标签编辑弹窗（通用版，不依赖 plugin）
export function openTagEditModal(
  container: HTMLElement,
  label: string,
  currentTagValue: string,
  onConfirm: (newTag: string) => Promise<void>
): void {
  const overlay = createModalOverlay(container);
  const modal = createModalCard(overlay);
  modal.appendChild(createModalTitle(tp("modal.modifyLabel", { label })));

  const displayValue = currentTagValue.startsWith("#")
    ? currentTagValue.substring(1)
    : currentTagValue;
  const input = createModalInput(modal, t("modal.placeholder.tagName"), displayValue);
  const errorEl = createModalError(modal);

  const btnRow = createModalButtonRow(modal);
  btnRow.appendChild(createModalButton(t("modal.button.cancel"), "secondary", () => overlay.remove()));
  btnRow.appendChild(createModalButton(t("modal.button.confirm"), "primary", async (btn) => {
    const newName = input.value.trim();
    const validation = validateTagName(newName);
    if (!validation.valid) {
      errorEl.textContent = validation.message || t("validation.tagName.invalid");
      errorEl.removeClass("cashlog-hidden");
      return;
    }

    const newTag = "#" + newName;
    if (newTag === currentTagValue) {
      overlay.remove();
      return;
    }

    btn.disabled = true;
    btn.textContent = t("modal.button.processing");

    try {
      await onConfirm(newTag);
      overlay.remove();
    } catch (e) {
      new Notice(tp("notice.tagEditFailed", { message: (e as Error).message }));
      btn.disabled = false;
      btn.textContent = t("modal.button.confirm");
    }
  }));

  finishModal(overlay, container, input);
}

// ========== 高级 Modal 函数 ==========

type ModalRefreshFn = () => void;

export function closeModalAndRefresh(overlay: HTMLElement, refreshPanel?: ModalRefreshFn): void {
  overlay.remove();
  if (refreshPanel) {
    refreshPanel();
  }
}

// 带回调的确认按钮创建器
export function createAsyncModalButton(
  text: string,
  type: "primary" | "secondary",
  onClick: (btn: HTMLButtonElement) => Promise<void>,
  onSuccess?: ModalRefreshFn
): HTMLButtonElement {
  const btn = activeDocument.createElement("button");
  btn.className = "cashlog-settings-btn";
  if (type === "primary") {
    btn.classList.add("cashlog-settings-btn-primary");
  } else {
    btn.classList.add("cashlog-settings-btn-secondary");
  }
  btn.textContent = text;
  btn.addEventListener("click", () => {
    void (async () => {
      btn.disabled = true;
      btn.textContent = t("modal.button.processing");
      try {
        await onClick(btn);
        if (onSuccess) onSuccess();
      } catch (e) {
        new Notice(tp("notice.operationFailed", { message: (e as Error).message }));
        btn.disabled = false;
        btn.textContent = text;
      }
    })();
  });
  return btn;
}