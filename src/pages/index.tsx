import { Button, Group, Title } from '@mantine/core';
import { signIn, signOut, useSession } from 'next-auth/react';
import Head from 'next/head';
import { AppLayout } from '~/components/AppLayout/AppLayout';
import { trpc } from '~/utils/trpc';
import styles from './index.module.css';

function Home() {
  const { data } = trpc.example.hello.useQuery({ text: 'from tRPC' });

  return (
    <>
      <Head>
        <title>Create T3 App</title>
        <meta name="description" content="Generated by create-t3-app" />
      </Head>
      <AppLayout>
        <Group p="md">
          <Title>This is the home page</Title>
        </Group>
      </AppLayout>
    </>
  );
}

export default Home;
