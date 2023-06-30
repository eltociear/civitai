import { Tabs, createStyles } from '@mantine/core';
import { IconBrush, IconListDetails, IconSlideshow } from '@tabler/icons-react';
import { Feed } from './Feed';
import { Generate } from './Generate';
import { Queue } from './Queue';
import { useGenerationPanelControls } from '~/components/ImageGeneration/GenerationPanel';

export default function GenerationDrawer({}) {
  const { classes } = useStyles();

  const view = useGenerationPanelControls((state) => state.view);
  const setView = useGenerationPanelControls((state) => state.setView);

  return (
    <Tabs
      value={view}
      onTabChange={setView}
      variant="pills"
      classNames={classes}
      keepMounted={false}
      inverted
    >
      <Tabs.Panel value="generate" pt={0}>
        <Generate onSuccess={() => setView('queue')} />
      </Tabs.Panel>
      <Tabs.Panel value="queue" py={0}>
        <Queue />
      </Tabs.Panel>
      <Tabs.Panel value="feed" py={0}>
        <Feed />
      </Tabs.Panel>

      <Tabs.List grow>
        <Tabs.Tab value="generate" icon={<IconBrush size={16} />} data-autofocus>
          Generate
        </Tabs.Tab>
        <Tabs.Tab value="queue" icon={<IconListDetails size={16} />}>
          Queue
        </Tabs.Tab>
        <Tabs.Tab value="feed" icon={<IconSlideshow size={16} />}>
          Feed
        </Tabs.Tab>
      </Tabs.List>
    </Tabs>
  );
}

const useStyles = createStyles((theme) => ({
  panel: {
    padding: theme.spacing.md,
    height: 'calc(100vh - 54px)',

    [theme.fn.smallerThan('md')]: {
      height: 'calc(90vh - 54px)',
    },
  },
  tabsList: {
    gap: 0,
    borderTop: `1px solid ${
      theme.colorScheme === 'dark' ? theme.colors.dark[4] : theme.colors.gray[2]
    }`,
  },
  tab: {
    borderRadius: 0,
    flexDirection: 'column',
    gap: '4px',
  },
}));