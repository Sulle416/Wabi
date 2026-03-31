import { NextRequest, NextResponse } from "next/server";
import { auth } from "./backend/lib/auth";
import { prisma } from "./backend/lib/prisma";

export async function proxy(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  const url = req.nextUrl.pathname;

  if (session) {
    const data = await prisma.user.findFirst({
      where: { id: session.user.id },
      select: { role: { select: { name: true } } },
    });
    if (url?.includes("/signin")) {
      return NextResponse.redirect(
        new URL(
          data?.role?.name === "teacher"
            ? "/teacher"
            : data?.role?.name === "student"
              ? "/student"
              : "/staff",
          req.nextUrl,
        ),
      );
    }
    //  else if (data?.role?.name == "teacher" && !url?.startsWith("/teacher")) {
    //   return NextResponse.redirect(new URL("/teacher", req.nextUrl));
    // } else if (data?.role?.name == "student" && !url?.startsWith("/student")) {
    //   return NextResponse.redirect(new URL("/student", req.nextUrl));
    // } 
    else return NextResponse.next();
  } else {
    if (["staff", "teacher", "student"].find((value) => url?.includes(value))) {
      return NextResponse.redirect(new URL("/signin", req.nextUrl));
    } else return NextResponse.next();
  }
}
