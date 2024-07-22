import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

import {
  Page,
  BlockStack,
  Button,
  Text,
  List
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { useLoaderData } from "@remix-run/react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(
    `#graphql
    query {
      shop {
        myshopifyDomain
      }
  }`,
  );


  const data = await response.json();
  return json({
    data,
    
  });
};

export default function Index() {
  const { data,  } = useLoaderData<typeof loader>();


  const handleDeepLink = () => {
    const openUrl = `https://${data.data.shop.myshopifyDomain}/admin/themes/current/editor?context=apps&template=index&activateAppId=4295a453-8591-40ee-945c-a97021d386e2/gc-app`;
    window.open(openUrl, "_blank");
  }

  return (
    <Page>
      <TitleBar title="Installation Instructions">
      </TitleBar>
      <BlockStack gap="500">
        <img style={{maxWidth:1000, width:'99%'}} width={1000} src={`/instructions.jpg`} alt="instructions" />
        <Text variant="headingXl" as="h4">How to Manually Install:</Text>
        <List type="number">
          <List.Item>Select the theme you'd like to install the app on, and hit "Customize".</List.Item>
          <List.Item>Select "App Embeds" from the menu on the left side.</List.Item>
          <List.Item>Select and toggle the app embed to "On".</List.Item>
          <List.Item>Click "Save" in the upper-right corner.</List.Item>
        </List>
        <Text variant="headingSm" as="h6">Or simply click the button below to automatically install the app on your live theme.</Text>
        <Button variant="primary" tone="success" onClick={handleDeepLink}>
          Install
        </Button>
      </BlockStack>
    </Page>
  );
}
