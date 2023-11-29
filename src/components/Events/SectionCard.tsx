import { CardProps, Card, Stack, Text, Title, createStyles } from '@mantine/core';

const useStyles = createStyles((theme) => ({
  card: {
    padding: '40px 80px !important',

    [theme.fn.smallerThan('sm')]: {
      padding: '16px !important',
    },
  },
}));

export function SectionCard({
  title,
  subtitle,
  children,
  headerAlign = 'center',
  ...cardProps
}: Props) {
  const { classes } = useStyles();
  return (
    <Card className={classes.card} radius="lg" {...cardProps}>
      <Stack align="center" spacing={48}>
        {(title || subtitle) && (
          <Stack spacing={4} align={headerAlign}>
            {title && (
              <Title order={2} size={32} align={headerAlign}>
                {title}
              </Title>
            )}
            {subtitle && (
              <Text color="dimmed" size="xl" align={headerAlign}>
                For each milestone you reach, you will get a reward. Stay active while the event is
                ongoing to get all the rewards.
              </Text>
            )}
          </Stack>
        )}
        {children}
      </Stack>
    </Card>
  );
}

type Props = CardProps & {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerAlign?: React.CSSProperties['textAlign'];
};
