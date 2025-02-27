<!-- Do not edit this file. It is automatically generated by API Documenter. -->

[Home](./index.md) &gt; [@microsoft/teamsfx](./teamsfx.md) &gt; [InvokeResponseFactory](./teamsfx.invokeresponsefactory.md) &gt; [adaptiveCard](./teamsfx.invokeresponsefactory.adaptivecard.md)

## InvokeResponseFactory.adaptiveCard() method

Create an invoke response from an adaptive card.

The type of the invoke response is `application/vnd.microsoft.card.adaptive` indicates the request was successfully processed, and the response includes an adaptive card that the client should display in place of the current one.

<b>Signature:</b>

```typescript
static adaptiveCard(card: IAdaptiveCard): InvokeResponse;
```

## Parameters

|  Parameter | Type | Description |
|  --- | --- | --- |
|  card | IAdaptiveCard | The adaptive card JSON payload. |

<b>Returns:</b>

InvokeResponse

{<!-- -->InvokeResponse<!-- -->} An InvokeResponse object.

