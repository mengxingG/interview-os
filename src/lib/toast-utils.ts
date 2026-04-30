/**
 * Toast utility helpers for consistent Notion API feedback.
 *
 * Provides a standardized wrapper around sonner's toast.promise
 * for all Notion write operations across the app.
 */

import { toast } from "sonner";

/**
 * Wraps a fetch call with toast.promise for consistent UX feedback.
 * The toast.promise handles the promise lifecycle internally.
 *
 * @param url - The API endpoint to call
 * @param options - Fetch options (method, headers, body, etc.)
 * @param messages - Custom toast messages for loading/success/error states
 * @param onSuccess - Optional callback after successful response
 */
export function toastFetch<T = unknown>(
  url: string,
  options: RequestInit,
  messages: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((err: Error) => string);
  },
  onSuccess?: (data: T) => void,
  onFinally?: () => void,
): void {
  const promise = (async (): Promise<T> => {
    const response = await fetch(url, options);
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorBody = (await response.json()) as {
          error?: string;
          detail?: string;
        };
        errorMessage = errorBody.detail ?? errorBody.error ?? errorMessage;
      } catch {
        try {
          errorMessage = (await response.text()) || errorMessage;
        } catch {
          // keep default
        }
      }
      throw new Error(errorMessage);
    }
    const data = (await response.json()) as T;
    return data;
  })();

  toast.promise(promise, {
    loading: messages.loading,
    success: (data: T) => {
      onSuccess?.(data);
      onFinally?.();
      return typeof messages.success === "function"
        ? messages.success(data)
        : messages.success;
    },
    error: (err: Error) => {
      onFinally?.();
      return typeof messages.error === "function"
        ? messages.error(err)
        : messages.error;
    },
  });
}
