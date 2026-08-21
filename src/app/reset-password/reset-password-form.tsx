"use client";

type Props = {
  formAction: (formData: FormData) => void;
  pending: boolean;
  error?: string;
};

export function ResetPasswordForm({ formAction, pending, error }: Props) {
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="newPassword"
          className="text-sm text-zinc-600 dark:text-zinc-400"
        >
          New password
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          required
          autoComplete="new-password"
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label
          htmlFor="confirmNewPassword"
          className="text-sm text-zinc-600 dark:text-zinc-400"
        >
          Confirm new password
        </label>
        <input
          id="confirmNewPassword"
          name="confirmNewPassword"
          type="password"
          required
          autoComplete="new-password"
          className="rounded border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
      >
        {pending ? "Resetting password…" : "Reset password"}
      </button>
    </form>
  );
}
