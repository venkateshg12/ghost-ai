// Every in-app path in one place. `/` is the canvas: a local draft for guests, a scratch pad for members.
export const ROUTES = {
  home: "/",
  signIn: "/sign-in",
  signUp: "/sign-up",
  forgotPassword: "/forgot-password",
  project: (id: string) => `/editor/${id}`,
} as const;
