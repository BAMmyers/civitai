import { createServerSideHelpers } from '@trpc/react-query/server';
import { GetServerSidePropsContext, GetServerSidePropsResult, Redirect } from 'next';
import { Session } from 'next-auth';
import superjson from 'superjson';
import { Tracker } from '~/server/clickhouse/client';

import { appRouter } from '~/server/routers';
import { FeatureAccess, getFeatureFlagsLazy } from '~/server/services/feature-flags.service';
import { getServerAuthSession } from '~/server/utils/get-server-auth-session';

export const getServerProxySSGHelpers = async (
  ctx: GetServerSidePropsContext,
  session: Session | null,
  features: ReturnType<typeof getFeatureFlagsLazy>
) => {
  const ssg = createServerSideHelpers({
    router: appRouter,
    ctx: {
      user: session?.user,
      acceptableOrigin: true,
      features,
      track: new Tracker(),
      ip: null as any,
      res: null as any,
      cache: null as any,
      req: null as any,
      fingerprint: null as any,
    },
    transformer: superjson,
  });
  return ssg;
};

export function createServerSideProps<P>({
  resolver,
  useSSG,
  useSession = false,
  prefetch = 'once',
}: CreateServerSidePropsProps<P>) {
  return async (context: GetServerSidePropsContext) => {
    const isClient = context.req.url?.startsWith('/_next/data') ?? false;
    const session =
      (context.req as any)['session'] ?? (useSession ? await getServerAuthSession(context) : null);
    const features = getFeatureFlagsLazy({ user: session?.user, req: context.req });

    const ssg =
      useSSG && (prefetch === 'always' || !isClient)
        ? await getServerProxySSGHelpers(context, session, features)
        : undefined;

    const result = (await resolver({
      ctx: context,
      isClient,
      ssg,
      session,
      features,
    })) as GetPropsFnResult<P> | undefined;

    let props: GetPropsFnResult<P>['props'] | undefined;
    if (result) {
      if (result.redirect) return { redirect: result.redirect };
      if (result.notFound) return { notFound: result.notFound };

      props = result.props;
    }

    return {
      props: {
        session,
        // flags: features,
        ...(props ?? {}),
        ...(ssg ? { trpcState: ssg.dehydrate() } : {}),
      },
    };
  };
}

type GetPropsFnResult<P> = {
  props: P | Promise<P>;
  redirect: Redirect;
  notFound: true;
};

type CreateServerSidePropsProps<P> = {
  useSSG?: boolean;
  useSession?: boolean;
  prefetch?: 'always' | 'once';
  resolver: (
    context: CustomGetServerSidePropsContext
  ) => Promise<GetServerSidePropsResult<P> | void>;
};

type CustomGetServerSidePropsContext = {
  ctx: GetServerSidePropsContext;
  isClient: boolean;
  ssg?: AsyncReturnType<typeof getServerProxySSGHelpers>;
  session?: Session | null;
  features?: FeatureAccess;
  // browsingLevel: number;
};
