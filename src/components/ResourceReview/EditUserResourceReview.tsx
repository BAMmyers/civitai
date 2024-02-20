import {
  Alert,
  Button,
  Card,
  Center,
  Divider,
  Group,
  Loader,
  Rating,
  Stack,
  Text,
  createStyles,
} from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';
import { useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { z } from 'zod';

import { DaysFromNow } from '~/components/Dates/DaysFromNow';
import {
  useCreateResourceReview,
  useQueryUserResourceReview,
  useUpdateResourceReview,
} from '~/components/ResourceReview/resourceReview.utils';
import { EditorCommandsRef } from '~/components/RichTextEditor/RichTextEditor';
import { Form, InputRTE, useForm } from '~/libs/form';
import { ResourceReviewModel } from '~/server/selectors/resourceReview.selector';
import { ResourceAccessWrap } from '../Access/ResourceAccessWrap';

const schema = z.object({
  details: z.string().optional(),
});

export type ReviewEditCommandsRef = {
  save: () => void;
};

export function EditUserResourceReview({
  resourceReview,
  modelId,
  modelName,
  modelVersionName,
  modelVersionId,
  openedCommentBox = false,
  showNoAccessAlert,
  innerRef,
}: Props) {
  const [editDetail, setEditDetail] = useState(openedCommentBox);
  const toggleEditDetail = () => {
    setEditDetail((state) => !state);
    if (!editDetail) setTimeout(() => commentRef.current?.focus(), 100);
  };
  const commentRef = useRef<EditorCommandsRef | null>(null);

  const createMutation = useCreateResourceReview();
  const updateMutation = useUpdateResourceReview();

  const createReviewWithRating = (rating: number) => {
    createMutation.mutate({ modelVersionId, modelId, rating, recommended: rating >= 3 });
  };

  const updateReview = ({ rating, details }: { rating?: number; details?: string }) => {
    if (!resourceReview) return;
    updateMutation.mutate(
      { id: resourceReview.id, rating, details },
      {
        onSuccess: (response, request) => {
          if (request.details) {
            toggleEditDetail();
            form.reset({ details: request.details as string });
          }
        },
      }
    );
  };

  const form = useForm({
    schema,
    defaultValues: { details: resourceReview?.details ?? '' },
  });
  const handleSubmit = ({ details }: z.infer<typeof schema>) => updateReview({ details });

  const handleRatingChange = (rating: number) => {
    !resourceReview?.id ? createReviewWithRating(rating) : updateReview({ rating });
  };

  useEffect(() => {
    form.reset({ details: resourceReview?.details ?? '' });
  }, [resourceReview?.details]); // eslint-disable-line

  // Used to call editor commands outside the component via a ref
  useImperativeHandle(innerRef, () => ({
    save: () => {
      if (form.formState.isDirty) form.handleSubmit(handleSubmit)();
    },
  }));

  modelVersionName ??= resourceReview?.modelVersion.name;

  return (
    <ResourceAccessWrap
      entityType="ModelVersion"
      entityId={modelVersionId}
      fallback={
        showNoAccessAlert ? (
          <Alert>You cannot review a resource you have no access to</Alert>
        ) : undefined
      }
    >
      <Card p={8} withBorder>
        <Stack spacing="xs">
          <Stack spacing={4}>
            <Group align="center" position="apart">
              <Stack spacing={0}>
                {modelName && <Text lineClamp={1}>{modelName}</Text>}
                {modelVersionName && (
                  <Text lineClamp={1} size="xs" color="dimmed">
                    {modelVersionName}
                  </Text>
                )}
              </Stack>
              <Rating value={resourceReview?.rating} onChange={handleRatingChange} />
            </Group>
            {resourceReview?.createdAt && (
              <Text size="xs">
                Reviewed <DaysFromNow date={resourceReview.createdAt} />
              </Text>
            )}
          </Stack>

          {resourceReview?.id && (
            <>
              <Card.Section>
                <Divider />
              </Card.Section>
              <Stack>
                {!editDetail ? (
                  <Text variant="link" onClick={toggleEditDetail} size="sm">
                    <Group spacing={4} sx={{ cursor: 'pointer' }}>
                      <IconChevronDown size={16} />{' '}
                      <span>{!resourceReview.details ? 'Add' : 'Edit'} Review Comments</span>
                    </Group>
                  </Text>
                ) : (
                  <Form form={form} onSubmit={handleSubmit}>
                    <Stack spacing="xs">
                      <InputRTE
                        name="details"
                        includeControls={['formatting', 'link']}
                        hideToolbar
                        editorSize="sm"
                        innerRef={commentRef}
                        placeholder={`What did you think of ${modelName}?`}
                        styles={{ content: { maxHeight: 500, overflowY: 'auto' } }}
                        // withLinkValidation
                      />
                      <Group grow spacing="xs">
                        <Button size="xs" variant="default" onClick={toggleEditDetail}>
                          Cancel
                        </Button>
                        <Button
                          size="xs"
                          type="submit"
                          variant={form.formState.isDirty ? undefined : 'outline'}
                          loading={updateMutation.isLoading}
                        >
                          Save
                        </Button>
                      </Group>
                    </Stack>
                  </Form>
                )}
              </Stack>
            </>
          )}
        </Stack>
      </Card>
    </ResourceAccessWrap>
  );
}

type Props = {
  resourceReview?: ResourceReviewModel;
  modelId: number;
  modelName?: string;
  modelVersionName?: string;
  modelVersionId: number;
  openedCommentBox?: boolean;
  innerRef?: React.ForwardedRef<ReviewEditCommandsRef>;
  showNoAccessAlert?: boolean;
};

const useStyles = createStyles(() => ({
  opened: {
    transform: 'rotate(180deg)',
    transition: 'transform 200ms ease',
  },
}));

type UserResourceReviewCompositeProps = {
  userReview: ResourceReviewModel | null | undefined;
  modelId: number;
  modelVersionId: number;
  modelName?: string;
};

export function UserResourceReviewComposite({
  modelId,
  modelVersionId,
  modelName,
  children,
}: Props & { children: (props: UserResourceReviewCompositeProps) => JSX.Element | null }) {
  const { currentUserReview, loading } = useQueryUserResourceReview({ modelVersionId });

  return loading ? (
    <Center p="xs">
      <Loader />
    </Center>
  ) : (
    children({
      userReview: currentUserReview,
      modelId,
      modelVersionId,
      modelName,
    })
  );
}

export function EditUserResourceReviewV2({
  modelVersionId,
  modelName,
  innerRef,
  userReview,
  showReviewedAt = true,
}: PropsV2) {
  const { classes, cx } = useStyles();
  const [opened, setOpened] = useState(false);

  const { loading: loadingUserReview } = useQueryUserResourceReview({ modelVersionId });

  const form = useForm({
    schema,
    defaultValues: { details: userReview?.details ?? '' },
  });

  const updateMutation = useUpdateResourceReview();
  const updateReview = ({ rating, details }: { rating?: number; details?: string }) => {
    if (!userReview) return;
    updateMutation.mutate(
      { id: userReview.id, rating, details },
      {
        onSuccess: (_, payload) => {
          if (payload.details) {
            handleToggleOpen();
            form.reset({ details: payload.details as string });
          }
        },
      }
    );
  };

  const handleSubmit = ({ details }: z.infer<typeof schema>) => updateReview({ details });
  const handleToggleOpen = useCallback(() => setOpened((v) => !v), []);
  const handleCancel = () => {
    form.reset({ details: userReview?.details ?? '' });
    handleToggleOpen();
  };

  useEffect(() => {
    form.reset({ details: userReview?.details ?? '' });
  }, [userReview?.details]); // eslint-disable-line

  const hasComment = !!userReview?.details;
  const { isDirty } = form.formState;

  // Used to call editor commands outside the component via a ref
  useImperativeHandle(innerRef, () => ({
    save: () => {
      if (form.formState.isDirty) form.handleSubmit(handleSubmit)();
    },
  }));

  if (!userReview) return null;

  return (
    <Stack pos="relative">
      <Group spacing={8} position="apart">
        <Text variant="link" size="sm" style={{ cursor: 'pointer' }} onClick={handleToggleOpen}>
          <Group spacing={4}>
            <IconChevronDown className={cx({ [classes.opened]: opened })} size={20} />
            <span>{hasComment ? 'Edit' : 'Add'} Review Comments</span>
          </Group>
        </Text>
        {userReview && showReviewedAt && (
          <Text color="dimmed" size="xs">
            Reviewed <DaysFromNow date={userReview.createdAt} />
          </Text>
        )}
      </Group>
      {opened && (
        <Form form={form} onSubmit={handleSubmit}>
          <Stack spacing="xs">
            <InputRTE
              name="details"
              includeControls={['formatting', 'link']}
              hideToolbar
              editorSize="sm"
              placeholder={`What did you think of ${modelName ?? 'this resource'}?`}
              styles={{ content: { maxHeight: 500, overflowY: 'auto' } }}
              autoFocus
            />
            <Group grow spacing="xs">
              <Button size="xs" variant="default" onClick={handleCancel}>
                Cancel
              </Button>
              <Button
                size="xs"
                type="submit"
                disabled={!isDirty}
                loading={updateMutation.isLoading || loadingUserReview}
              >
                Save
              </Button>
            </Group>
          </Stack>
        </Form>
      )}
    </Stack>
  );
}

type PropsV2 = {
  modelVersionId: number;
  userReview: ResourceReviewModel | null;
  modelName?: string;
  showReviewedAt?: boolean;
  innerRef?: React.ForwardedRef<ReviewEditCommandsRef>;
};
