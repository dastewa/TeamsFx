const { AdaptiveCards } = require("@microsoft/adaptivecards-tools");
const { AdaptiveCardResponse, InvokeResponseFactory } = require("@microsoft/teamsfx");
const responseCard = require("../adaptiveCards/doStuffActionResponse.json");

class DoStuffActionHandler {
  triggerVerb = "doStuff";
  adaptiveCardResponse = AdaptiveCardResponse.ReplaceForInteractor;

  async handleActionInvoked(context, message) {
    /**
     * You can send an adaptive card to respond to the card action invoke.
     */
    const cardData = {
      title: "Hello World Bot",
      body: "Congratulations! Your task is processed successfully. Click the button below to learn more about Bots and the Teams Toolkit.",
    };

    const cardJson = AdaptiveCards.declare(responseCard).render(cardData);
    return InvokeResponseFactory.adaptiveCard(cardJson);

    /**
     * If you want to send invoke response with text message, you can:
     * 
     return InvokeResponseFactory.textMessage("[ACK] Successfully!");
    */

    /**
     * If you want to send invoke response with error message, you can:
     *
     * return InvokeResponseFactory.errorResponse(InvokeResponseErrorCode.BadRequest, "The incoming request is invalid.");
     */
  }
}

module.exports = {
  DoStuffActionHandler,
};
